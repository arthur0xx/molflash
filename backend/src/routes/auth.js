import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET مطلوب عند تشغيل chrigsm في بيئة الإنتاج');
}
const SECRET = process.env.JWT_SECRET || 'chrigsm-development-only-secret';

export const sign = (user) => jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '30d' });

export const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'غير مسجّل دخول' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user || user.is_active !== 1) return res.status(401).json({ error: 'الحساب غير نشط' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'انتهت الجلسة، سجّل دخول مجدداً' });
  }
};

export const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرّح' });
    next();
  });
};

const publicUser = (u) => ({
  id: u.id, name: u.name, phone: u.phone, balance: u.balance,
  role: u.role, created_at: u.created_at,
});

router.post('/register', (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) return res.status(400).json({ error: 'المرجو ملء جميع الحقول' });
  if (String(phone).length < 9) return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
  if (String(password).length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(String(phone));
  if (exists) return res.status(400).json({ error: 'هذا الرقم مسجّل مسبقاً' });
  const hash = bcrypt.hashSync(String(password), 10);
  const r = db.prepare('INSERT INTO users (name, phone, password) VALUES (?,?,?)')
    .run(String(name), String(phone), hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  res.json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { phone, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(String(phone || ''));
  if (!user) return res.status(400).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
  if (!bcrypt.compareSync(String(password || ''), user.password))
    return res.status(400).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
  if (user.is_active !== 1) return res.status(403).json({ error: 'حسابك معطّل من الإدارة' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
