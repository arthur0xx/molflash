import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const [min, setMin] = useState(params.get('min') || '');
  const [max, setMax] = useState(params.get('max') || '');
  const [sort, setSort] = useState(params.get('sort') || 'popular');
  const category = params.get('category') || '';

  useEffect(() => { api('/categories').then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = new URLSearchParams();
      if (category) query.set('category', category);
      if (q.trim()) query.set('q', q.trim());
      if (min) query.set('min', min);
      if (max) query.set('max', max);
      query.set('sort', sort);
      setLoading(true);
      api(`/tools?${query.toString()}`).then(setTools).catch(() => setTools([])).finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [category, q, min, max, sort]);

  const selectCategory = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id); else next.delete('category');
    setParams(next);
  };

  const activeCategoryName = useMemo(() => categories.find((item) => String(item.id) === String(category))?.name || 'الكل', [categories, category]);

  return (
    <main className="app-page catalog-page">
      <div className="app-container">
        <div className="page-heading">
          <div><span className="page-kicker">ChriGsm</span><h1>الكتالوغ</h1></div>
          <span className="result-count">{tools.length} خدمة</span>
        </div>

        <div className="app-search catalog-search">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ابحث عن خدمة أو أداة" aria-label="ابحث عن خدمة أو أداة" />
        </div>

        <div className="filter-rail" aria-label="تصنيفات الكاتالوغ">
          <button type="button" onClick={() => selectCategory('')} className={!category ? 'active' : ''}>الكل</button>
          {categories.map((item) => <button key={item.id} type="button" onClick={() => selectCategory(item.id)} className={String(category) === String(item.id) ? 'active' : ''}>{item.name}</button>)}
        </div>

        <div className="catalog-tools-row">
          <button type="button" className={`control-chip ${filterOpen ? 'active' : ''}`} onClick={() => setFilterOpen((value) => !value)}>☷ فلترة</button>
          <label className="control-chip sort-select">↕ فرز
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="ترتيب النتائج">
              <option value="popular">المميز</option>
              <option value="newest">الأحدث</option>
              <option value="price_asc">السعر: الأقل</option>
              <option value="price_desc">السعر: الأعلى</option>
            </select>
          </label>
          <span>تصنيف: {activeCategoryName}</span>
        </div>

        {filterOpen ? (
          <div className="filters-panel">
            <label>السعر من<input inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder="0" /></label>
            <label>السعر إلى<input inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder="—" /></label>
            <button type="button" className="reset-filter" onClick={() => { setMin(''); setMax(''); setSort('popular'); }}>إعادة الضبط</button>
          </div>
        ) : null}

        <section className="catalog-results">
          {loading ? <p className="empty-state">جارٍ تحميل الخدمات…</p> : null}
          {!loading && !tools.length ? <p className="empty-state">لا توجد خدمات مطابقة للبحث أو الفلاتر الحالية.</p> : null}
          {!loading && tools.map((tool) => <ProductCard key={tool.tool_key} product={tool} variant="list" />)}
        </section>
      </div>
    </main>
  );
}
