import { Router } from 'express';
import db from '../db.js';

const router = Router();

const productRow = (p) => ({
  id: p.id, category_id: p.category_id, name: p.name, description: p.description,
  price: p.price, old_price: p.old_price, emoji: p.emoji, gradient: p.gradient,
  is_featured: p.is_featured, is_active: p.is_active, sold_count: p.sold_count,
  category_name: p.category_name,
});

router.get('/categories', (req, res) => {
  const cats = db.prepare(`SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id ORDER BY c.sort_order ASC`).all();
  res.json(cats);
});

router.get('/products', (req, res) => {
  const { category, q, min, max, sort, featured } = req.query;
  const where = ['p.is_active = 1'];
  const params = [];
  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
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
  const s = {};
  rows.forEach(r => { if (['whatsapp_number', 'currency', 'store_name'].includes(r.key)) s[r.key] = r.value; });
  res.json(s);
});

router.get('/products/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.is_active = 1`).get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'المنتج غير موجود' });
  const related = db.prepare(`SELECT * FROM products WHERE category_id = ? AND id != ? AND is_active = 1 ORDER BY sold_count DESC LIMIT 4`)
    .all(p.category_id, p.id);
  res.json({ product: productRow(p), related: related.map(productRow) });
});

export default router;
