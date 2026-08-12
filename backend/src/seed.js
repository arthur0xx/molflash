import db from './db.js';
import bcrypt from 'bcryptjs';

export default function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (count > 0) return;

  const insertCat = db.prepare('INSERT INTO categories (name, emoji, description, sort_order) VALUES (?,?,?,?)');
  const cats = [
    ['تفعيل عراق سيرفر', '🎮', 'تفعيلات وأكواد عراق سيرفر بكل المدد', 1],
    ['تفعيل حلا تيك', '📱', 'تفعيلات حلا تيك والحسابات الجاهزة', 2],
    ['تطبيقات برو', '🚀', 'تفعيل التطبيقات المدفوعة بنسخ برو', 3],
    ['ألعاب', '🕹️', 'شحن وتفعيل الألعاب الشهيرة', 4],
    ['اشتراكات', '📺', 'اشتراكات المنصات مثل نتفليكس وسبوتيفاي', 5],
    ['أكواد تعبئة', '💳', 'أكواد تعبئة الرصيد الفورية', 6],
  ];
  const catIds = [];
  for (const c of cats) {
    const r = insertCat.run(...c);
    catIds.push(r.lastInsertRowid);
  }

  const insertProduct = db.prepare(`INSERT INTO products
    (category_id, name, description, price, old_price, emoji, gradient, is_featured, sold_count)
    VALUES (?,?,?,?,?,?,?,?,?)`);

  const products = [
    [catIds[0], 'تفعيل عراق سيرفر - شهر واحد', 'تفعيل سريع خلال دقائق. تدخل لحمّل معانا وتوصلك معلومات الدخول في حسابك مباشرة بعد الشراء.', 25, 35, '🎮', 'linear-gradient(135deg,#16a34a,#059669)', 1, 120],
    [catIds[0], 'تفعيل عراق سيرفر - 3 أشهر', 'باقة 3 أشهر بأفضل سعر. تجديد تلقائي اختياري.', 60, 80, '🎮', 'linear-gradient(135deg,#2563eb,#7c3aed)', 1, 89],
    [catIds[0], 'تفعيل عراق سيرفر - 6 أشهر', 'باقة نصف سنوية بسعر مخفض.', 100, 130, '🎮', 'linear-gradient(135deg,#7c3aed,#c026d3)', 0, 45],
    [catIds[0], 'تفعيل عراق سيرفر - سنة كاملة', 'أفضل قيمة: سنة كاملة بأقل سعر.', 170, 240, '🎮', 'linear-gradient(135deg,#f59e0b,#ef4444)', 1, 60],
    [catIds[1], 'تفعيل حلا تيك - شهر', 'تفعيل اشتراك حلا تيك لمدة شهر.', 30, 45, '📱', 'linear-gradient(135deg,#0ea5e9,#6366f1)', 1, 150],
    [catIds[1], 'تفعيل حلا تيك - 3 أشهر', 'باقة 3 أشهر لتفعيل حلا تيك.', 75, 100, '📱', 'linear-gradient(135deg,#06b6d4,#0ea5e9)', 0, 70],
    [catIds[1], 'حساب حلا تيك بريميوم جاهز', 'حساب جاهز مع ضمان 30 يوم.', 90, 120, '📱', 'linear-gradient(135deg,#8b5cf6,#6d28d9)', 0, 33],
    [catIds[2], 'تفعيل تطبيق VIP - دائم', 'تفعيل دائم للتطبيق على نفس الحساب.', 40, 60, '🚀', 'linear-gradient(135deg,#f43f5e,#fb923c)', 0, 200],
    [catIds[2], 'باقة تطبيقات برو الشاملة', 'مجموعة تطبيقات برو مشتركة بسعر رمزي.', 55, 90, '🚀', 'linear-gradient(135deg,#d946ef,#8b5cf6)', 1, 78],
    [catIds[3], 'شحن جواهر لعبة 100', 'شحن جواهر للعبة الشهيرة فوري.', 20, 30, '🕹️', 'linear-gradient(135deg,#22c55e,#16a34a)', 0, 95],
    [catIds[3], 'شحن عملات لعبة 500', '500 عملة داخل اللعبة خلال دقائق.', 45, 60, '🕹️', 'linear-gradient(135deg,#eab308,#f97316)', 0, 42],
    [catIds[4], 'اشتراك نتفليكس - شهر', 'اشتراك خاص لمدة شهر بجودة عالية.', 35, 50, '📺', 'linear-gradient(135deg,#ef4444,#7f1d1d)', 1, 55],
    [catIds[4], 'اشتراك سبوتيفاي بريميوم - شهر', 'اشتراك سبوتيفاي بريميوم خاص.', 25, 40, '📺', 'linear-gradient(135deg,#22c55e,#0f766e)', 0, 61],
    [catIds[5], 'كود تعبئة 20 درهم', 'كود تعبئة فوري يصل لمحفظتك مباشرة.', 20, 20, '💳', 'linear-gradient(135deg,#6366f1,#4338ca)', 1, 500],
    [catIds[5], 'كود تعبئة 50 درهم', 'كود تعبئة 50 درهم بقيمة كاملة.', 50, 50, '💳', 'linear-gradient(135deg,#10b981,#047857)', 0, 300],
    [catIds[5], 'كود تعبئة 100 درهم', 'أفضل خيار للتعبئة الكبيرة.', 100, 100, '💳', 'linear-gradient(135deg,#f59e0b,#b45309)', 1, 120],
  ];
  for (const p of products) insertProduct.run(...p);

  const hashed = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT OR IGNORE INTO users (name, phone, password, balance, role) VALUES (?,?,?,?,?)')
    .run('المدير', '0600000000', hashed, 0, 'admin');

  const u1 = bcrypt.hashSync('customer123', 10);
  const u2 = bcrypt.hashSync('customer123', 10);
  db.prepare('INSERT OR IGNORE INTO users (name, phone, password, balance, role) VALUES (?,?,?,?,?)')
    .run('زبون تجريبي', '0611111111', u1, 120, 'customer');
  db.prepare('INSERT OR IGNORE INTO users (name, phone, password, balance, role) VALUES (?,?,?,?,?)')
    .run('زبون تجريبي 2', '0622222222', u2, 45, 'customer');

  const vouchers = db.prepare('INSERT OR IGNORE INTO vouchers (code, amount) VALUES (?,?)');
  vouchers.run('TARBIB-20', 20);
  vouchers.run('TARBIB-50', 50);
  vouchers.run('MARHABA-100', 100);

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('whatsapp_number', '212600000000')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('whatsapp_api', '')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('currency', 'درهم')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_name', 'chrigsm')").run();

  console.log('✅ تم تجهيز قاعدة البيانات ببيانات تجريبية');
}
