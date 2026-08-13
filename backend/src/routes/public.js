import { Router } from 'express';
import db from '../db.js';
import { parseFields } from '../util.js';

const router = Router();
const productRow = (p) => ({
  id: p.id, category_id: p.category_id, name: p.name, description: p.description,
  price: p.price, old_price: p.old_price, emoji: p.emoji, gradient: p.gradient,
  is_featured: p.is_featured, is_active: p.is_active, sold_count: p.sold_count,
  source_service_id: p.source_service_id, service_type: p.service_type, delivery_time: p.delivery_time,
  tool_key: p.tool_key, tool_name: p.tool_name, package_label: p.package_label, asset_status: p.asset_status || 'none', asset_path: p.asset_path || '',
  fields: parseFields(p),
  category_name: p.category_name,
});

const toolKeySql = "COALESCE(NULLIF(p.tool_key, ''), 'service-' || p.source_service_id)";
const toolNameSql = "COALESCE(NULLIF(p.tool_name, ''), p.name)";

function toolRow(row) {
  return {
    tool_key: row.tool_key,
    tool_name: row.tool_name,
    description: row.description,
    category_id: row.category_id,
    category_name: row.category_name,
    service_type: row.service_type,
    delivery_time: row.delivery_time,
    emoji: row.emoji,
    gradient: row.gradient,
    is_featured: row.is_featured,
    sold_count: row.sold_count,
    package_count: row.package_count,
    price: row.price,
    max_price: row.max_price,
    asset_status: row.asset_status || 'none',
    asset_path: row.asset_path || '',
  };
}

function loadTools(query = {}, featuredOnly = false) {
  const { category, q, min, max, sort } = query;
  const where = ['p.is_active = 1'];
  const params = [];
  if (featuredOnly) where.push('p.is_featured = 1');
  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (q) {
    where.push(`(${toolNameSql} LIKE ? OR p.name LIKE ? OR c.name LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const having = [];
  if (min) { having.push('MIN(p.price) >= ?'); params.push(Number(min)); }
  if (max) { having.push('MIN(p.price) <= ?'); params.push(Number(max)); }

  let order = 'is_featured DESC, sold_count DESC, tool_name COLLATE NOCASE';
  if (sort === 'price_asc') order = 'price ASC, tool_name COLLATE NOCASE';
  if (sort === 'price_desc') order = 'price DESC, tool_name COLLATE NOCASE';
  if (sort === 'newest') order = 'last_service_id DESC';
  if (sort === 'popular') order = 'sold_count DESC, tool_name COLLATE NOCASE';

  const rows = db.prepare(`
    SELECT
      ${toolKeySql} AS tool_key,
      MIN(${toolNameSql}) AS tool_name,
      MIN(p.description) AS description,
      MIN(p.category_id) AS category_id,
      MIN(c.name) AS category_name,
      MIN(p.service_type) AS service_type,
      MIN(p.delivery_time) AS delivery_time,
      MIN(p.emoji) AS emoji,
      MIN(p.gradient) AS gradient,
      MAX(p.is_featured) AS is_featured,
      SUM(p.sold_count) AS sold_count,
      COUNT(*) AS package_count,
      MIN(p.price) AS price,
      MAX(p.price) AS max_price,
      MIN(p.asset_status) AS asset_status,
      MIN(NULLIF(p.asset_path, '')) AS asset_path,
      MAX(p.source_service_id) AS last_service_id
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')}
    GROUP BY ${toolKeySql}
    ${having.length ? `HAVING ${having.join(' AND ')}` : ''}
    ORDER BY ${order}
  `).all(...params);
  return rows.map(toolRow);
}

router.get('/categories', (req, res) => {
  const cats = db.prepare(`SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id ORDER BY c.sort_order ASC`).all();
  res.json(cats);
});

// واجهات الأدوات الجديدة: أداة واحدة تحمل باقات متعددة.
router.get('/tools', (req, res) => res.json(loadTools(req.query)));
router.get('/tools/featured', (req, res) => res.json(loadTools(req.query, true).slice(0, 12)));
router.get('/tools/:toolKey', (req, res) => {
  const toolKey = String(req.params.toolKey || '');
  const rows = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND ${toolKeySql} = ?
    ORDER BY p.price ASC, p.id DESC`).all(toolKey);
  if (!rows.length) return res.status(404).json({ error: 'الأداة غير موجودة' });

  const packages = rows.map(productRow);
  const first = rows[0];
  const tool = toolRow({
    tool_key: toolKey,
    tool_name: first.tool_name || first.name,
    description: first.description,
    category_id: first.category_id,
    category_name: first.category_name,
    service_type: first.service_type,
    delivery_time: first.delivery_time,
    emoji: first.emoji,
    gradient: first.gradient,
    is_featured: rows.some((row) => row.is_featured) ? 1 : 0,
    sold_count: rows.reduce((sum, row) => sum + (Number(row.sold_count) || 0), 0),
    package_count: rows.length,
    price: Math.min(...rows.map((row) => Number(row.price) || 0)),
    max_price: Math.max(...rows.map((row) => Number(row.price) || 0)),
    asset_status: first.asset_status,
    asset_path: first.asset_path,
  });

  const related = loadTools({ category: first.category_id })
    .filter((item) => item.tool_key !== toolKey)
    .slice(0, 4);
  res.json({ tool, packages, related });
});

// واجهات المنتجات القديمة تبقى عاملة من أجل السلة والطلب وتفاصيل كل باقة.
router.get('/products', (req, res) => {
  const { category, q, min, max, sort, featured } = req.query;
  const where = ['p.is_active = 1'];
  const params = [];
  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ? OR p.tool_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (min) { where.push('p.price >= ?'); params.push(Number(min)); }
  if (max) { where.push('p.price <= ?'); params.push(Number(max)); }
  if (featured === '1') where.push('p.is_featured = 1');

  let order = 'p.sold_count DESC, p.id DESC';
  if (sort === 'price_asc') order = 'p.price ASC';
  if (sort === 'price_desc') order = 'p.price DESC';
  if (sort === 'newest') order = 'p.id DESC';
  if (sort === 'popular') order = 'p.sold_count DESC';

  const rows = db.prepare(`SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(...params);
  res.json(rows.map(productRow));
});

router.get('/products/featured', (req, res) => {
  const rows = db.prepare(`SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.is_featured = 1
    ORDER BY p.sold_count DESC LIMIT 12`).all();
  res.json(rows.map(productRow));
});

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((row) => {
    if (['whatsapp_number', 'currency', 'store_name'].includes(row.key)) settings[row.key] = row.value;
  });
  res.json(settings);
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.is_active = 1`).get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'الباقة غير موجودة' });
  const related = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
    ORDER BY p.sold_count DESC LIMIT 4`).all(product.category_id, product.id);
  res.json({ product: productRow(product), related: related.map(productRow) });
});

export default router;
