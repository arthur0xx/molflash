import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const sourcePath = path.resolve(frontendDir, '../backend/src/data/gsm-services.json');
const outputDir = path.join(frontendDir, 'public', 'static-api');
const sourceCatalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

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
    fields.push({ key: 'primary_input', label: compactText(primary.customname), type: 'text', required: true });
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

function assetPathFor() {
  // The storefront deliberately uses icon-first cards. Owners can add a product image later.
  return '';
}

const categories = [];
const products = [];
let categoryId = 1;
let productId = 1;
let featuredCount = 0;

for (const group of Object.values(sourceCatalog)) {
  const groupType = compactText(group.GROUPTYPE).toUpperCase() || 'SERVER';
  const style = paletteByType[groupType] || paletteByType.SERVER;
  const services = Object.values(group.SERVICES || {});
  if (!services.length) continue;

  const category = {
    id: categoryId,
    name: compactText(group.GROUPNAME),
    emoji: style.emoji,
    description: `${style.label} — ${services.length} خدمة. اختر الخدمة ثم أضف المعلومات المطلوبة.`,
    sort_order: categories.length,
    product_count: services.length,
  };
  categories.push(category);

  for (const [serviceIndex, service] of services.entries()) {
    const name = compactText(service.SERVICENAME);
    const { toolName, toolKey, packageLabel } = toolDescriptor(name);
    const price = Number(service.CREDIT);
    const deliveryTime = compactText(service.TIME) || 'حسب تفاصيل الخدمة';
    const isFeatured = serviceIndex === 0 && featuredCount < 12 ? 1 : 0;
    if (isFeatured) featuredCount += 1;
    products.push({
      id: productId++,
      category_id: category.id,
      category_name: category.name,
      name,
      description: `${toolName} — ${packageLabel}. خدمة ${style.label} عبر chrigsm، بزمن تنفيذ متوقع: ${deliveryTime}. ستظهر الحقول المطلوبة قبل تأكيد الطلب.`,
      price: Number.isFinite(price) ? price : 0,
      old_price: null,
      emoji: style.emoji,
      gradient: style.gradient,
      is_featured: isFeatured,
      is_active: 1,
      sold_count: 0,
      fields: serviceFields(service),
      source_service_id: String(service.SERVICEID || ''),
      service_type: groupType,
      delivery_time: deliveryTime,
      tool_key: toolKey,
      tool_name: toolName,
      package_label: packageLabel,
      asset_status: 'none',
      asset_path: assetPathFor(),
    });
  }
  categoryId += 1;
}

const byTool = new Map();
for (const product of products) {
  if (!byTool.has(product.tool_key)) byTool.set(product.tool_key, []);
  byTool.get(product.tool_key).push(product);
}

const tools = [...byTool.entries()].map(([toolKey, packages]) => {
  const first = packages[0];
  const prices = packages.map((item) => item.price);
  return {
    tool_key: toolKey,
    tool_name: first.tool_name,
    description: first.description,
    category_id: first.category_id,
    category_name: first.category_name,
    service_type: first.service_type,
    delivery_time: first.delivery_time,
    emoji: first.emoji,
    gradient: first.gradient,
    is_featured: packages.some((item) => item.is_featured) ? 1 : 0,
    sold_count: 0,
    package_count: packages.length,
    price: Math.min(...prices),
    max_price: Math.max(...prices),
    asset_status: 'none',
    asset_path: '',
  };
}).sort((a, b) => b.is_featured - a.is_featured || a.tool_name.localeCompare(b.tool_name));

const catalog = {
  generated_at: new Date().toISOString(),
  categories,
  products,
  tools,
  featured: tools.filter((tool) => tool.is_featured).slice(0, 12),
  settings: { store_name: 'ChriGsm', currency: 'MAD', catalog_mode: 'demo_preview' },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'catalog.json'), `${JSON.stringify(catalog)}\n`);
console.log(`Generated static catalog: ${products.length} packages, ${tools.length} tools, ${categories.length} categories.`);
