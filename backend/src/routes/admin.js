import { Router } from 'express';
import db from '../db.js';
import { adminAuth } from './auth.js';
import { orderDetails, orderStatusText } from './orders.js';
import { addNotification, waLinkTo, orderStatusMessage } from '../notify.js';
import { parseFields, normalizeFields } from '../util.js';

const router = Router();

router.get('/stats', adminAuth, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'customer'").get().c;
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const orders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'rejected'").get().s;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c;
  const today = db.prepare("SELECT COUNT(*) c FROM orders WHERE date(created_at) = date('now')").get().c;
  const pendingWallet = db.prepare("SELECT COUNT(*) c FROM wallet_transactions WHERE type='credit' AND status='pending'").get().c;
  res.json({ users, products, orders, revenue, pending, today, pendingWallet });
});

// ---------- Products ----------
router.get('/products', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC`).all();
  res.json(rows.map(p => ({ ...p, fields: parseFields(p) })));
});

router.post('/products', adminAuth, (req, res) => {
  const p = req.body || {};
  if (!p.name || !p.category_id || !Number(p.price))
    return res.status(400).json({ error: 'الاسم والتصنيف والسعر مطلوبة' });
  const r = db.prepare(`INSERT INTO products (category_id, name, description, price, old_price, emoji, gradient, is_featured, is_active, fields)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      Number(p.category_id), String(p.name), p.description || '', Number(p.price),
      p.old_price ? Number(p.old_price) : null, p.emoji || '🎁',
      p.gradient || 'linear-gradient(135deg,#7c3aed,#4f46e5)',
      p.is_featured ? 1 : 0, p.is_active === undefined ? 1 : (p.is_active ? 1 : 0),
      JSON.stringify(normalizeFields(p.fields)));
  res.json({ id: r.lastInsertRowid });
});

router.put('/products/:id', adminAuth, (req, res) => {
  const p = req.body || {};
  db.prepare(`UPDATE products SET category_id=?, name=?, description=?, price=?, old_price=?,
    emoji=?, gradient=?, is_featured=?, is_active=?, fields=? WHERE id=?`).run(
      Number(p.category_id), String(p.name), p.description || '', Number(p.price),
      p.old_price ? Number(p.old_price) : null, p.emoji || '🎁',
      p.gradient || 'linear-gradient(135deg,#7c3aed,#4f46e5)',
      p.is_featured ? 1 : 0, p.is_active ? 1 : 0,
      JSON.stringify(normalizeFields(p.fields)), Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/products/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM order_items WHERE product_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- Categories ----------
router.get('/categories', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order').all());
});

router.post('/categories', adminAuth, (req, res) => {
  const c = req.body || {};
  if (!c.name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
  const r = db.prepare('INSERT INTO categories (name, emoji, description, sort_order) VALUES (?,?,?,?)')
    .run(String(c.name), c.emoji || '🛍️', c.description || '', Number(c.sort_order) || 0);
  res.json({ id: r.lastInsertRowid });
});

router.put('/categories/:id', adminAuth, (req, res) => {
  const c = req.body || {};
  db.prepare('UPDATE categories SET name=?, emoji=?, description=?, sort_order=? WHERE id=?')
    .run(String(c.name), c.emoji || '🛍️', c.description || '', Number(c.sort_order) || 0, Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/categories/:id', adminAuth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM products WHERE category_id = ?').get(Number(req.params.id)).c;
  if (count > 0) return res.status(400).json({ error: 'لا يمكن حذف تصنيف يحتوي منتجات' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- Users ----------
router.get('/users', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT id, name, phone, balance, role, is_active, created_at,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = users.id) AS orders_count
    FROM users ORDER BY id DESC`).all();
  res.json(rows);
});

router.post('/users/:id/balance', adminAuth, (req, res) => {
  const { amount, description } = req.body || {};
  const amt = Number(amount);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (!amt) return res.status(400).json({ error: 'مبلغ غير صحيح' });
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amt, user.id);
  db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, description) VALUES (?,?,?,?,?)")
    .run(user.id, amt, amt > 0 ? 'credit' : 'debit', 'admin', description || 'تعديل يدوي من الإدارة');
  addNotification(user.id, amt > 0 ? 'تمت إضافة رصيد' : 'تم خصم رصيد',
    `${amt > 0 ? 'تمت إضافة' : 'تم خصم'} ${Math.abs(amt)} درهم ${description ? '— ' + description : ''}`);
  res.json({ balance: user.balance + amt });
});

router.post('/users/:id/toggle', adminAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (user.role === 'admin') return res.status(400).json({ error: 'لا يمكن تعطيل حساب المدير' });
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, user.id);
  res.json({ ok: true });
});

// ---------- Orders ----------
router.get('/orders', adminAuth, (req, res) => {
  const { status } = req.query;
  const where = status && status !== 'all' ? 'WHERE o.status = ?' : '';
  const params = status && status !== 'all' ? [status] : [];
  const rows = db.prepare(`SELECT o.*, u.name AS user_name, u.phone AS user_phone
    FROM orders o JOIN users u ON u.id = o.user_id ${where} ORDER BY o.id DESC LIMIT 200`).all(...params);
  res.json(rows.map(o => {
    const { items, itemsText } = orderDetails(o);
    return { ...o, status_text: orderStatusText(o.status), items, itemsText };
  }));
});

router.put('/orders/:id/status', adminAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'success', 'rejected'].includes(status))
    return res.status(400).json({ error: 'حالة غير صحيحة' });
  const order = db.prepare('SELECT o.*, u.name AS user_name, u.phone AS user_phone FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?')
    .get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (status === 'rejected' && order.status !== 'rejected') {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(order.total, order.user_id);
    db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, description) VALUES (?,?,?,?,?)")
      .run(order.user_id, order.total, 'credit', 'refund', `استرداد طلب #${order.id}`);
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);
  const statusText = orderStatusText(status);
  addNotification(order.user_id, `تحديث حالة الطلب #${order.id}`,
    `طلبك أصبح: ${statusText}.`);

  const { itemsText } = orderDetails(order);
  const msg = orderStatusMessage({ ...order, items_text: itemsText }, statusText);
  const wa = waLinkTo(order.whatsapp || order.user_phone, msg);
  res.json({ ok: true, wa_link: wa, customer_phone: order.user_phone, message: msg });
});

// ---------- Wallet requests ----------
router.get('/wallet/requests', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT w.*, u.name AS user_name, u.phone AS user_phone
    FROM wallet_transactions w JOIN users u ON u.id = w.user_id
    WHERE w.type = 'credit' AND w.status = 'pending' ORDER BY w.id DESC`).all();
  res.json(rows);
});

router.post('/wallet/requests/:id/approve', adminAuth, (req, res) => {
  const w = db.prepare('SELECT * FROM wallet_transactions WHERE id = ? AND status = "pending"').get(Number(req.params.id));
  if (!w) return res.status(404).json({ error: 'الطلب غير موجود' });
  db.prepare("UPDATE wallet_transactions SET status = 'success' WHERE id = ?").run(w.id);
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(w.amount, w.user_id);
  addNotification(w.user_id, 'تمت الموافقة على التعبئة',
    `تمت إضافة ${w.amount} درهم إلى محفظتك بنجاح.`);
  res.json({ ok: true });
});

router.post('/wallet/requests/:id/reject', adminAuth, (req, res) => {
  const w = db.prepare('SELECT * FROM wallet_transactions WHERE id = ? AND status = "pending"').get(Number(req.params.id));
  if (!w) return res.status(404).json({ error: 'الطلب غير موجود' });
  db.prepare("UPDATE wallet_transactions SET status = 'rejected' WHERE id = ?").run(w.id);
  addNotification(w.user_id, 'تم رفض طلب التعبئة', 'تم رفض طلب التعبئة اليدوي. تواصل مع الدعم.');
  res.json({ ok: true });
});

// ---------- Vouchers ----------
router.post('/vouchers/generate', adminAuth, (req, res) => {
  const { amount, count } = req.body || {};
  const amt = Number(amount);
  const cnt = Math.min(50, Math.max(1, Number(count) || 1));
  if (!amt || amt <= 0) return res.status(400).json({ error: 'مبلغ غير صحيح' });
  const ins = db.prepare('INSERT INTO vouchers (code, amount) VALUES (?,?)');
  const codes = [];
  for (let i = 0; i < cnt; i++) {
    const code = 'RC-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    ins.run(code, amt);
    codes.push(code);
  }
  res.json({ codes });
});

router.get('/vouchers', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT v.*, u.name AS used_by_name FROM vouchers v
    LEFT JOIN users u ON u.id = v.used_by ORDER BY v.id DESC LIMIT 200`).all();
  res.json(rows);
});

// ---------- Settings ----------
router.get('/settings', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  res.json(s);
});

router.put('/settings', adminAuth, (req, res) => {
  const s = req.body || {};
  const keys = ['whatsapp_number', 'whatsapp_api', 'whatsapp_token', 'currency', 'store_name'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
  for (const k of keys) if (s[k] !== undefined) upsert.run(k, String(s[k]));
  res.json({ ok: true });
});

export default router;
