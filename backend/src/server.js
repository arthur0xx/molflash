import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import orderRoutes from './routes/orders.js';
import walletRoutes from './routes/wallet.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
if (isProduction && !allowedOrigins.length) {
  throw new Error('CORS_ORIGIN مطلوب عند تشغيل chrigsm في بيئة الإنتاج');
}
const app = express();
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin غير مسموح'));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', orderRoutes);
app.use('/api', walletRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  const admins = db.prepare("SELECT name, phone FROM users WHERE role = 'admin'").all();
  console.log('🔑 حسابات المدير:', admins.map(a => `${a.phone}`).join(' / '));
});
