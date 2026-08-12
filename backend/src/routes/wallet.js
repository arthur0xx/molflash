import { Router } from 'express';
import db from '../db.js';
import { auth } from './auth.js';
import { addNotification, waLink } from '../notify.js';

const router = Router();

router.get('/wallet', auth, (req, res) => {
  const txns = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
  res.json({ balance: req.user.balance, transactions: txns });
});

router.post('/wallet/voucher', auth, (req, res) => {
  const { code } = req.body || {};
  const v = db.prepare('SELECT * FROM vouchers WHERE code = ?').get(String(code || '').trim().toUpperCase());
  if (!v) return res.status(400).json({ error: 'الكود غير صحيح' });
  if (v.used) return res.status(400).json({ error: 'هذا الكود مستعمل من قبل' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE vouchers SET used = 1, used_by = ? WHERE id = ?').run(req.user.id, v.id);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(v.amount, req.user.id);
    db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, description, ref) VALUES (?,?,?,?,?,?)")
      .run(req.user.id, v.amount, 'credit', 'voucher', 'تفعيل كود تعبئة', v.code);
  });
  tx();

  addNotification(req.user.id, 'تمت تعبئة المحفظة',
    `تمت إضافة ${v.amount} درهم إلى محفظتك عبر الكود ${v.code}.`);
  res.json({ message: `تمت إضافة ${v.amount} درهم لمحفظتك`, balance: req.user.balance + v.amount });
});

router.post('/wallet/bank-request', auth, (req, res) => {
  const { amount, method, ref } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'مبلغ غير صحيح' });
  if (amt > 5000) return res.status(400).json({ error: 'الحد الأقصى 5000 درهم للطلب الواحد' });

  db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, status, description, ref) VALUES (?,?,?,?,?,?,?)")
    .run(req.user.id, amt, 'credit', method === 'crypto' ? 'crypto' : 'bank', 'pending',
      `طلب تعبئة يدوي ${method === 'crypto' ? 'عبر عملة رقمية' : 'عبر تحويل بنكي'}`, ref || '');

  const adminMsg = `💰 طلب تعبئة يدوي\n\n` +
    `الزبون: ${req.user.name} (${req.user.phone})\n` +
    `المبلغ: ${amt} درهم\n` +
    `الطريقة: ${method === 'crypto' ? 'عملة رقمية' : 'تحويل بنكي'}\n` +
    (ref ? `مرجع التحويل: ${ref}\n` : '') +
    `يرجى مراجعة اللوحة وتأكيد التعبئة.`;

  addNotification(req.user.id, 'طلب التعبئة قيد المراجعة',
    `طلب إضافة ${amt} درهم قيد المراجعة، سيتم إخطارك عند الموافقة.`);
  res.json({ message: 'تم إرسال طلب التعبئة، بانتظار موافقة الإدارة', wa_link: waLink(adminMsg) });
});

router.get('/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json(rows);
});

router.post('/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
