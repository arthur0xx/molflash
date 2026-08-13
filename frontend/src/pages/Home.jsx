import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

const categoryIcon = ['⌁', '◈', '◷', '✦'];

function ServiceSection({ title, items, categoryId }) {
  if (!items.length) return null;
  return (
    <section className="app-section">
      <div className="section-title-row">
        <h2>{title}</h2>
        <Link to={`/shop?category=${categoryId}`}>عرض الكل</Link>
      </div>
      <div className="horizontal-products">
        {items.slice(0, 8).map((item) => <ProductCard key={item.tool_key} product={item} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api('/tools'), api('/categories')])
      .then(([nextTools, nextCategories]) => {
        setTools(nextTools);
        setCategories(nextCategories);
      })
      .catch(() => {});
  }, []);

  const grouped = useMemo(() => new Map(categories.map((category) => [category.id, tools.filter((tool) => tool.category_id === category.id)])), [categories, tools]);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
  };

  return (
    <main className="app-page home-app-page">
      <div className="app-container">
        <form className="app-search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن أداة أو خدمة" aria-label="ابحث عن أداة أو خدمة" />
        </form>

        <section className="category-rail" aria-label="تصنيفات الخدمات">
          {categories.map((category, index) => (
            <Link key={category.id} to={`/shop?category=${category.id}`} className="category-rail-item">
              <span>{categoryIcon[index] || '◌'}</span>
              <b>{category.name}</b>
            </Link>
          ))}
        </section>

        {categories.map((category) => (
          <ServiceSection key={category.id} title={category.name} items={grouped.get(category.id) || []} categoryId={category.id} />
        ))}

        <section className="app-section owner-note">
          <div className="section-title-row"><h2>إدارة الكتالوج</h2></div>
          <p>هذه بيانات تجريبية فقط. أضف منتجاتك وأسعارك وصورك لاحقاً من لوحة الإدارة.</p>
          <Link to="/admin" className="text-link">فتح لوحة الإدارة ←</Link>
        </section>
      </div>
    </main>
  );
}
