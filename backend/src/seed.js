import db from './db.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const catalogPath = new URL('./data/gsm-services.json', import.meta.url);
const sourceCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const DEMO_PHONES = ['0600000000', '0611111111', '0622222222'];
const DEMO_VOUCHERS = ['TARBIB-20', 'TARBIB-50', 'MARHABA-100'];

const paletteByType = {
  ACTIVATION: { emoji: '🔐', gradient: 'linear-gradient(135deg,#eaf3ff,#d8e8ff)', label: 'تفعيل الأدوات' },
  SERVER: { emoji: '🛡️', gradient: 'linear-gradient(135deg,#eef5ff,#dceaff)', label: 'خدمات السيرفر' },
  RENTAL: { emoji: '⏱️', gradient: 'linear-gradient(135deg,#f3f7ff,#e5edff)', label: 'كراء الأدوات' },
  MISC: { emoji: '✦', gradient: 'linear-gradient(135deg,#eff6ff,#e3efff)', label: 'خدمات رقمية متنوعة' },
};

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function serviceFields(service) {
  const fields = [];
  const primary = service.CUSTOM;
  if (primary?.allow === '1' && primary.customname) {
    fields.push({
      key: 'primary_input',
      label: compactText(primary.customname),
      type: 'text',
      required: true,
    });
  }

  for (const [index, input] of (service['Requires.Custom'] || []).entries()) {
    const label = compactText(input.fieldname);
    if (!label || fields.some((field) => field.label === label)) continue;
    fields.push({
      key: `field_${index + 1}`,
      label,
      type: input.fieldtype === 'textarea' ? 'textarea' : 'text',
      required: input.required === 'on',
    });
  }
  return fields;
}

function toolDescriptor(serviceName) {
  const rawName = compactText(serviceName);
  const packageWords = /\b(?:rent(?:\s+for)?|activation|license|subscription|renew(?:al)?|recharge(?:\s+your)?\s+balance|credit(?:s|\s+refill)?|refill)\b/gi;
  const toolName = compactText(rawName
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b\d+\s*(?:months?|years?|days?|hours?|pcs?|users?|accounts?)\b/gi, '')
    .replace(/\b(?:new|existing)\s+users?\b/gi, '')
    .replace(packageWords, '')
    .replace(/[\[\]]/g, '')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim());

  const duration = rawName.match(/\b\d+\s*(?:months?|years?|days?|hours?)\b/i)?.[0] || '';
  const credit = /\b(?:credits?|recharge|refill)\b/i.test(rawName) ? 'رصيد' : '';
  const renewal = /\b(?:renew|refill|recharge)\b/i.test(rawName) ? 'تجديد' : '';
  const packageLabel = [duration, credit, renewal].filter(Boolean).join(' · ') || 'باقة خدمة';
  const safeToolName = toolName || rawName;
  const toolKey = safeToolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `service-${Date.now()}`;
  return { toolName: safeToolName, toolKey, packageLabel };
}

function isDemoOnlyDatabase() {
  const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const importedProducts = db.prepare("SELECT COUNT(*) AS c FROM products WHERE source_service_id != ''").get().c;
  const demoUsers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE phone IN (${DEMO_PHONES.map(() => '?').join(',')})`).get(...DEMO_PHONES).c;
  return totalProducts > 0 && importedProducts === 0 && demoUsers > 0;
}

function removeKnownDemoData() {
  const demoUsers = db.prepare(`SELECT id FROM users WHERE phone IN (${DEMO_PHONES.map(() => '?').join(',')})`).all(...DEMO_PHONES);
  const demoUserIds = demoUsers.map((user) => user.id);

  if (demoUserIds.length) {
    const placeholders = demoUserIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (${placeholders}))`).run(...demoUserIds);
    db.prepare(`DELETE FROM orders WHERE user_id IN (${placeholders})`).run(...demoUserIds);
    db.prepare(`DELETE FROM wallet_transactions WHERE user_id IN (${placeholders})`).run(...demoUserIds);
    db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders})`).run(...demoUserIds);
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...demoUserIds);
  }

  db.prepare(`DELETE FROM vouchers WHERE code IN (${DEMO_VOUCHERS.map(() => '?').join(',')})`).run(...DEMO_VOUCHERS);
  db.prepare('DELETE FROM order_items WHERE product_id IN (SELECT id FROM products)').run();
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM categories').run();
}

function setInitialSettings() {
  const set = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
  set.run('store_name', 'ChriGsm');
  set.run('currency', 'MAD');
  set.run('whatsapp_number', '');
  set.run('whatsapp_api', '');
  set.run('whatsapp_token', '');
  db.prepare("UPDATE settings SET value = 'ChriGsm' WHERE key = 'store_name' AND value IN ('MolFlash', 'chrigsm')").run();
  db.prepare("UPDATE settings SET value = 'MAD' WHERE key = 'currency'").run();
  set.run('catalog_mode', 'static_import');
  set.run('catalog_imported_at', new Date().toISOString());
}

function bootstrapAdmin() {
  const phone = compactText(process.env.ADMIN_PHONE);
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = compactText(process.env.ADMIN_NAME) || 'مدير chrigsm';
  if (!phone || !password) return;
  if (db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()) return;

  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (name, phone, password, role) VALUES (?,?,?,?)')
    .run(name, phone, hash, 'admin');
  console.log('✅ تم إنشاء حساب المدير من متغيرات البيئة');
}

function bootstrapDemoAccounts() {
  const isEnabled = String(process.env.SEED_DEMO_ACCOUNTS || '').toLowerCase() === 'true';
  if (!isEnabled || process.env.NODE_ENV === 'production') return;

  const accounts = [
    { name: 'مدير تجريبي ChriGsm', phone: '0600000000', password: 'AdminDemo2026!', role: 'admin', balance: 0 },
    { name: 'عميل تجريبي ChriGsm', phone: '0611111111', password: 'ClientDemo2026!', role: 'customer', balance: 1500 },
  ];
  const createUser = db.prepare('INSERT INTO users (name, phone, password, balance, role) VALUES (?,?,?,?,?)');
  const addCredit = db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, method, status, description, ref) VALUES (?,?,?,?,?,?,?)");

  for (const account of accounts) {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(account.phone);
    if (existing) continue;
    const result = createUser.run(account.name, account.phone, bcrypt.hashSync(account.password, 12), account.balance, account.role);
    if (account.balance > 0) {
      addCredit.run(result.lastInsertRowid, account.balance, 'credit', 'demo', 'success', 'رصيد تجريبي للعميل', 'DEMO-SEED');
    }
  }
  console.log('✅ تم تجهيز حسابي الإدارة والعميل التجريبيين في بيئة التطوير');
}

export default function seed() {
  setInitialSettings();
  db.prepare("UPDATE products SET description = REPLACE(description, 'MolFlash', 'chrigsm') WHERE description LIKE '%MolFlash%'").run();
  bootstrapAdmin();
  bootstrapDemoAccounts();
  const existingImported = db.prepare("SELECT COUNT(*) AS c FROM products WHERE source_service_id != ''").get().c;
  if (existingImported > 0) return;

  const importCatalog = db.transaction(() => {
    if (isDemoOnlyDatabase()) removeKnownDemoData();

    const remainingProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
    if (remainingProducts > 0) return;

    const insertCategory = db.prepare('INSERT INTO categories (name, emoji, description, sort_order) VALUES (?,?,?,?)');
    const insertService = db.prepare(`INSERT INTO products
      (category_id, name, description, price, emoji, gradient, is_featured, is_active, sold_count, fields, source_service_id, service_type, delivery_time, tool_key, tool_name, package_label, asset_status, asset_path)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    let categoryOrder = 0;
    let featuredCount = 0;
    for (const group of Object.values(sourceCatalog)) {
      const groupType = compactText(group.GROUPTYPE).toUpperCase() || 'SERVER';
      const style = paletteByType[groupType] || paletteByType.SERVER;
      const services = Object.values(group.SERVICES || {});
      if (!services.length) continue;

      const categoryId = insertCategory.run(
        compactText(group.GROUPNAME),
        style.emoji,
        `${style.label} — ${services.length} خدمة. اختر الخدمة ثم أضف المعلومات المطلوبة.`,
        categoryOrder++,
      ).lastInsertRowid;

      for (const [serviceIndex, service] of services.entries()) {
        const price = Number(service.CREDIT);
        const duration = compactText(service.TIME) || 'حسب تفاصيل الخدمة';
        const name = compactText(service.SERVICENAME);
        const { toolName, toolKey, packageLabel } = toolDescriptor(name);
        const description = `${toolName} — ${packageLabel}. خدمة ضمن ${style.label}. ستظهر الحقول المطلوبة قبل تأكيد الطلب.`;
        const isFeatured = serviceIndex === 0 && featuredCount < 12 ? 1 : 0;
        if (isFeatured) featuredCount += 1;

        insertService.run(
          categoryId,
          name,
          description,
          Number.isFinite(price) ? price : 0,
          style.emoji,
          style.gradient,
          isFeatured,
          1,
          0,
          JSON.stringify(serviceFields(service)),
          String(service.SERVICEID || ''),
          groupType,
          duration,
          toolKey,
          toolName,
          packageLabel,
          'none',
          '',
        );
      }
    }
  });

  importCatalog();
  const count = db.prepare("SELECT COUNT(*) AS c FROM products WHERE source_service_id != ''").get().c;
  console.log(`✅ تم استيراد ${count} خدمة محلية إلى كتالوج chrigsm دون ربط API مباشر`);
}
