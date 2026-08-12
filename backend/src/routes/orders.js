import { Router } from 'express';
import db from '../db.js';
import { auth } from './auth.js';
import { addNotification, newOrderToAdmin, waLink } from '../notify.js';

const router = Router();

const STATUS_AR = { pending: 'قيد المعالجة', success: 'تم التسليم بنجاح', rejected: 'مرفوض' };

export const orderStatusText = (s) => STATUS_AR[s] || s;

export function orderDetails(order) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const itemsText = items.map(i => `• ${i.name} ×${i.quantity} — ${i.price} درهم`).join('\n');
  return { order, items, itemsText };
}

router.get('/orders', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const list = rows.map(o => {
    const { items, itemsText } = orderDetails(o);
    return { ...o, status_text: orderStatusText(o.status), items, itemsText };
  });
  res.json(list);
});

router.get('/orders/:id', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!o) return res.status(404).json({ error: 'الطلب غير موجود' });
  const { items, itemsText } = orderDetails(o);
  res.json({ ...o, status_text: orderStatusText(o.status), items, itemsText });
});

router.post('/orders', auth, (req, res) => {
  const { items, note } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'السلة فارغة' });

  let total = 0;
  const orderRows = [];
  const tx = db.transaction(() => {
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(Number(it.product_id));
      if (!p) throw new Error(`منتج غير متوفر: ${it.product_id}`);
      const qty = Math.max(1, Number(it.quantity) || 1);
      total += p.price * qty;
      orderRows.push({ product_id: p.id, name: p.name, price: p.price, quantity: qty });
    }
    if (total > req.user.balance) throw new Error('رصيد المحفظة غير كافٍ');

    const r = db.prepare('INSERT INTO orders (user_id, total, note) VALUES (?,?,?)')
      .run(req.user.id, total, note || '');
    const orderId = r.lastInsertRowid;
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?,?,?,?,?)');
    for (const oi of orderRows) ins.run(orderId, oi.product_id, oi.name, oi.price, oi.quantity);

    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(total, req.user.id);
    db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, description) VALUES (?,?,?,?,?)")
      .run(req.user.id, -total, 'debit', 'purchase', `شراء طلب #${orderId}`);
    for (const oi of orderRows)
      db.prepare('UPDATE products SET sold_count = sold_count + ? WHERE id = ?').run(oi.quantity, oi.product_id);

    return orderId;
  });

  try {
    const orderId = tx();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const { itemsText } = orderDetails(order);
    addNotification(req.user.id, `طلب جديد #${orderId}`,
      `تم استلام طلبك بقيمة ${total} درهم وهو الآن قيد المعالجة.`);
    const adminMsg = newOrderToAdmin({ ...order, user_name: req.user.name, user_phone: req.user.phone }, itemsText);
    res.json({ order: { ...order, status_text: orderStatusText(order.status) }, wa_link: waLink(adminMsg) });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

export default router;
