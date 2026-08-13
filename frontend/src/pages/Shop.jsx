import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState('popular');
  const category = params.get('category') || '';

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (q) qs.set('q', q);
    if (min) qs.set('min', min);
    if (max) qs.set('max', max);
    qs.set('sort', sort);
    api(`/tools?${qs}`).then(setTools).catch(() => setTools([])).finally(() => setLoading(false));
  }, [category, q, min, max, sort]);

  const setCategory = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id); else next.delete('category');
    setParams(next);
  };

  return (
    <div className="container shop-page">
      <div className="shop-top">
        <div>
          <div className="eyebrow">كتالوج chrigsm</div>
          <h1>الأدوات والخدمات</h1>
        </div>
        <input
          className="search-input"
          placeholder="ابحث عن أداة أو خدمة…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <div className="shop-layout">
        <aside className="filters">
          <div className="filter-group">
            <h4>التصنيفات</h4>
            <button className={`fcat ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>كل الأدوات</button>
            {categories.map((item) => (
              <button key={item.id} className={`fcat ${String(category) === String(item.id) ? 'active' : ''}`} onClick={() => setCategory(item.id)}>
                {item.emoji} {item.name} <span className="count">{item.product_count}</span>
              </button>
            ))}
          </div>
          <div className="filter-group">
            <h4>سعر بداية الباقة ({min || 0} - {max || '∞'})</h4>
            <div className="price-inputs">
              <input type="number" placeholder="من" value={min} onChange={(event) => setMin(event.target.value)} />
              <input type="number" placeholder="إلى" value={max} onChange={(event) => setMax(event.target.value)} />
            </div>
          </div>
          <div className="filter-group">
            <h4>الترتيب</h4>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="popular">الأكثر استخداماً</option>
              <option value="newest">الأحدث في الكتالوج</option>
              <option value="price_asc">سعر البداية: الأقل</option>
              <option value="price_desc">سعر البداية: الأعلى</option>
            </select>
          </div>
        </aside>

        <main className="shop-grid-wrap">
          {loading ? <p className="muted">جارٍ تحميل الأدوات…</p> : null}
          {!loading && !tools.length ? <div className="empty"><p>لا توجد أدوات مطابقة لبحثك.</p></div> : null}
          {!loading && tools.length ? <div className="shop-grid">{tools.map((tool) => <ProductCard key={tool.tool_key} product={tool} />)}</div> : null}
        </main>
      </div>
    </div>
  );
}
