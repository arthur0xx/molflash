import { Router } from 'express';
import db from '../db.js';
import { adminAuth } from './auth.js';
import { orderDetails, orderStatusText } from './orders.js';
import { addNotification, waLinkTo, orderStatusMessage } from '../notify.js';
import { parseFields, normalizeFields } from '../util.js';

const router = Router();
const DEFAULT_TOOL_ASSET = '/assets/chrigsm-default-service-hero.png';
const toolKeySql = "COALESCE(NULLIF(p.tool_key, ''), 'service-' || p.id)";
const toolKeyWriteSql = "COALESCE(NULLIF(tool_key, ''), 'service-' || id)";

function toolSummary(row) {
  return {
    ...row,
    asset_status: row.asset_status || 'default',
    asset_path: row.asset_path || DEFAULT_TOOL_ASSET,
  };
}

function slugifyToolKey(value) {
  return String(value || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `manual-${Date.now()}`;
}

router.get('/stats', adminAuth, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'customer'").get().c;
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const tools = db.prepare("SELECT COUNT(DISTINCT CASE WHEN tool_key != '' THEN tool_key ELSE 'service-' || id END) c FROM products").get().c;
  const readyAssets = db.prepare("SELECT COUNT(DISTINCT tool_key) c FROM products WHERE tool_key != '' AND asset_status = 'ready'").get().c;
  const pendingAssets = db.prepare("SELECT COUNT(DISTINCT tool_key) c FROM products WHERE tool_key != '' AND asset_status != 'ready'").get().c;
  const orders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'rejected'").get().s;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c;
  const today = db.prepare("SELECT COUNT(*) c FROM orders WHERE date(created_at) = date('now')").get().c;
  const pendingWallet = db.prepare("SELECT COUNT(*) c FROM wallet_transactions WHERE type='credit' AND status='pending'").get().c;
  const walletBalances = db.prepare("SELECT COALESCE(SUM(balance), 0) s FROM users WHERE role = 'customer'").get().s;
  res.json({ users, products, tools, readyAssets, pendingAssets, orders, revenue, pending, today, pendingWallet, walletBalances });
});

// ---------- Tools (one visual identity, multiple packages) ----------
router.get('/tools', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT
      ${toolKeySql} AS tool_key,
      MIN(COALESCE(NULLIF(p.tool_name, ''), p.name)) AS tool_name,
      MIN(p.category_id) AS category_id,
      MIN(c.name) AS category_name,
      COUNT(*) AS package_count,
      MIN(p.price) AS price,
      MAX(p.price) AS max_price,
      MAX(p.is_featured) AS is_featured,
      MIN(p.is_active) AS is_active,
      MIN(p.asset_status) AS asset_status,
      MIN(NULLIF(p.asset_path, '')) AS asset_path,
      MAX(p.id) AS last_package_id
    FROM products p JOIN categories c ON c.id = p.category_id
    GROUP BY ${toolKeySql}
    ORDER BY CASE WHEN MIN(p.asset_status) = 'ready' THEN 1 ELSE 0 END, tool_name COLLATE NOCASE`).all();
  res.json(rows.map(toolSummary));
});

router.get('/tools/assets/queue', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT
      ${toolKeySql} AS tool_key,
      MIN(COALESCE(NULLIF(p.tool_name, ''), p.name)) AS tool_name,
      MIN(c.name) AS category_name,
      COUNT(*) AS package_count,
      MIN(p.price) AS min_price,
      MAX(p.price) AS max_price
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE COALESCE(p.asset_status, 'default') != 'ready'
    GROUP BY ${toolKeySql}
    ORDER BY tool_name COLLATE NOCASE`).all();
  res.json({
    generated_at: new Date().toISOString(),
    total: rows.length,
    instructions: 'ضع صورة واحدة موثوقة لكل أداة في frontend/public/assets/tools/ ثم حدّث مسارها من لوحة الإدارة.',
    tools: rows.map((row) => ({
      ...row,
      asset_status: 'default',
      suggested_filename: `${row.tool_key}.png`,
      suggested_asset_path: `/assets/tools/${row.tool_key}.png`,
      action: 'manual_asset_review',
    })),
  });
});

router.get('/tools/:toolKey', adminAuth, (req, res) => {
  const toolKey = String(req.params.toolKey || '');
  const packages = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id WHERE ${toolKeySql} = ? ORDER BY p.price ASC, p.id DESC`).all(toolKey);
  if (!packages.length) return res.status(404).json({ error: 'الأداة غير موجودة' });
  const first = packages[0];
  res.json({
    tool: toolSummary({
      tool_key: toolKey,
      tool_name: first.tool_name || first.name,
      category_id: first.category_id,
      category_name: first.category_name,
      package_count: packages.length,
      price: Math.min(...packages.map((item) => Number(item.price) || 0)),
      max_price: Math.max(...packages.map((item) => Number(item.price) || 0)),
      is_featured: packages.some((item) => item.is_featured) ? 1 : 0,
      is_active: packages.every((item) => item.is_active) ? 1 : 0,
      asset_status: first.asset_status,
      asset_path: first.asset_path,
    }),
    packages: packages.map((item) => ({ ...item, fields: parseFields(item) })),
  });
});

router.put('/tools/:toolKey', adminAuth, (req, res) => {
  const toolKey = String(req.params.toolKey || '');
  const current = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id WHERE ${toolKeySql} = ? LIMIT 1`).get(toolKey);
  if (!current) return res.status(404).json({ error: 'الأداة غير موجودة' });

  const body = req.body || {};
  const toolName = String(body.tool_name ?? current.tool_name ?? current.name).trim() || current.name;
  const categoryId = body.category_id !== undefined ? Number(body.category_id) : current.category_id;
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!category) return res.status(400).json({ error: 'تصنيف غير صحيح' });
  const assetStatus = body.asset_status === 'ready' ? 'ready' : 'default';
  const assetPath = assetStatus === 'ready' ? String(body.asset_path ?? current.asset_path ?? '').trim() : '';
  if (assetStatus === 'ready' && !assetPath.startsWith('/assets/'))
    return res.status(400).json({ error: 'مسار الصورة يجب أن يبدأ بـ /assets/' });

  const featured = body.is_featured === undefined ? (current.is_featured ? 1 : 0) : (body.is_featured ? 1 : 0);
  const active = body.is_active === undefined ? (current.is_active ? 1 : 0) : (body.is_active ? 1 : 0);
  db.prepare(`UPDATE products SET tool_name=?, category_id=?, asset_status=?, asset_path=?, is_featured=?, is_active=?
    WHERE ${toolKeyWriteSql} = ?`).run(toolName, categoryId, assetStatus, assetPath, featured, active, toolKey);
  res.json({ ok: true });
});

// ---------- Products / packages ----------
router.get('/products', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC`).all();
  res.json(rows.map(p => ({ ...p, fields: parseFields(p) })));
});

router.post('/products', adminAuth, (req, res) => {
  const p = req.body || {};
  if (!p.name || !p.category_id || !Number(p.price))
    return res.status(400).json({ error: 'الاسم والتصنيف والسعر مطلوبة' });
  const toolName = String(p.tool_name || p.name).trim();
  const toolKey = String(p.tool_key || slugifyToolKey(toolName));
  const r = db.prepare(`INSERT INTO products (category_id, name, description, price, old_price, emoji, gradient, is_featured, is_active, fields, tool_key, tool_name, package_label, asset_status, asset_path)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      Number(p.category_id), String(p.name), p.description || '', Number(p.price),
      p.old_price ? Number(p.old_price) : null, p.emoji || '🎁',
      p.gradient || 'linear-gradient(135deg,#0e7490,#0891b2)',
      p.is_featured ? 1 : 0, p.is_active === undefined ? 1 : (p.is_active ? 1 : 0),
      JSON.stringify(normalizeFields(p.fields)), toolKey, toolName, p.package_label || 'باقة خدمة', 'default', '');
  res.json({ id: r.lastInsertRowid });
});

router.put('/products/:id', adminAuth, (req, res) => {
  const p = req.body || {};
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'الباقة غير موجودة' });
  db.prepare(`UPDATE products SET category_id=?, name=?, description=?, price=?, old_price=?,
    emoji=?, gradient=?, is_featured=?, is_active=?, fields=?, package_label=? WHERE id=?`).run(
      Number(p.category_id), String(p.name), p.description || '', Number(p.price),
      p.old_price ? Number(p.old_price) : null, p.emoji || '🎁',
      p.gradient || 'linear-gradient(135deg,#0e7490,#0891b2)',
      p.is_featured ? 1 : 0, p.is_active ? 1 : 0,
      JSON.stringify(normalizeFields(p.fields)), String(p.package_label || existing.package_label || 'باقة خدمة'), Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/products/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM order_items WHERE product_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- Categories ----------
router.get('/categories', adminAuth, (req, res) => {
  const rows = db.prepare(`SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order, c.id`).all();
  res.json(rows);
});

function normalizeCategoryIcon(value) {
  const iconUrl = String(value || '').trim();
  if (!iconUrl) return '';
  if (/^(https?:\/\/|data:image\/)/i.test(iconUrl)) return iconUrl;
  throw new Error('رابط الأيقونة يجب أن يكون رابط https أو ملف صورة مرفوعًا');
}

router.post('/categories', adminAuth, (req, res) => {
  const c = req.body || {};
  if (!c.name) return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
  try {
    const r = db.prepare('INSERT INTO categories (name, emoji, icon_url, description, sort_order) VALUES (?,?,?,?,?)')
      .run(String(c.name).trim(), c.emoji || '🛍️', normalizeCategoryIcon(c.icon_url), c.description || '', Number(c.sort_order) || 0);
    res.json({ id: r.lastInsertRowid });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.put('/categories/:id', adminAuth, (req, res) => {
  const c = req.body || {};
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'التصنيف غير موجود' });
  try {
    db.prepare('UPDATE categories SET name=?, emoji=?, icon_url=?, description=?, sort_order=? WHERE id=?')
      .run(String(c.name || existing.name).trim(), c.emoji || '🛍️', normalizeCategoryIcon(c.icon_url), c.description || '', Number(c.sort_order) || 0, existing.id);
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete('/categories/:id', adminAuth, (req, res) => {
  const categoryId = Number(req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) return res.status(404).json({ error: 'التصنيف غير موجود' });
  const confirmationName = String(req.body?.confirmationName || '').trim();
  if (confirmationName !== category.name) return res.status(400).json({ error: `اكتب اسم التصنيف (${category.name}) لتأكيد الحذف` });

  const removeCategoryTree = db.transaction(() => {
    const count = db.prepare('SELECT COUNT(*) c FROM products WHERE category_id = ?').get(categoryId).c;
    db.prepare('DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE category_id = ?)').run(categoryId);
    db.prepare('DELETE FROM products WHERE category_id = ?').run(categoryId);
    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
    return count;
  });

  const deletedProducts = removeCategoryTree();
  res.json({ ok: true, deletedProducts });
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
