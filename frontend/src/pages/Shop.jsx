import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState('popular');
  const category = params.get('category') || '';

  useEffect(() => {
    api('/categories').then(setCats).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (q) qs.set('q', q);
    if (min) qs.set('min', min);
    if (max) qs.set('max', max);
    qs.set('sort', sort);
    api(`/products?${qs}`).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, [category, q, min, max, sort]);

  const setCat = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id); else next.delete('category');
    setParams(next);
  };

  return (
    <div className="container shop-page">
      <div className="shop-top">
        <h1>المتجر</h1>
        <input
          className="search-input"
          placeholder="🔍 ابحث عن منتج، تفعيل، كود..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="shop-layout">
        <aside className="filters">
          <div className="filter-group">
            <h4>التصنيفات</h4>
            <button className={`fcat ${!category ? 'active' : ''}`} onClick={() => setCat('')}>الكل</button>
            {cats.map(c => (
              <button key={c.id} className={`fcat ${String(category) === String(c.id) ? 'active' : ''}`} onClick={() => setCat(c.id)}>
                {c.emoji} {c.name} <span className="count">{c.product_count}</span>
              </button>
            ))}
          </div>
          <div className="filter-group">
            <h4>السعر ({min || 0} - {max || '∞'})</h4>
            <div className="price-inputs">
              <input type="number" placeholder="من" value={min} onChange={e => setMin(e.target.value)} />
              <input type="number" placeholder="إلى" value={max} onChange={e => setMax(e.target.value)} />
            </div>
          </div>
          <div className="filter-group">
            <h4>الترتيب</h4>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="popular">الأكثر مبيعاً</option>
              <option value="newest">الأحدث</option>
              <option value="price_asc">السعر: من الأقل</option>
              <option value="price_desc">السعر: من الأعلى</option>
            </select>
          </div>
        </aside>

        <main className="shop-grid-wrap">
          {loading ? (
            <p className="muted">جارٍ التحميل...</p>
          ) : products.length === 0 ? (
            <div className="empty"><p>لا توجد منتجات مطابقة 😕</p></div>
          ) : (
            <div className="shop-grid">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
