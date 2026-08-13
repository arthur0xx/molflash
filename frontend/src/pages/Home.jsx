import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

function HScroll({ title, emoji, tools }) {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-head">
          <h2>{emoji} {title}</h2>
          <Link to="/shop" className="see-all">عرض جميع الأدوات ←</Link>
        </div>
        <div className="h-scroll">
          {tools.map((tool) => <ProductCard key={tool.tool_key} product={tool} />)}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tools, setTools] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api('/tools/featured').then(setFeatured).catch(() => {});
    api('/categories').then(setCategories).catch(() => {});
    api('/tools').then(setTools).catch(() => {});
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  const toolsByCategory = useMemo(() => new Map(
    categories.map((category) => [category.id, tools.filter((tool) => tool.category_id === category.id)]),
  ), [categories, tools]);

  return (
    <div>
      <section className="hero hero-chrigsm">
        <div className="hero-backdrop" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-text">
            <div className="eyebrow">CHRIGSM · GSM SERVICES</div>
            <h1>أدواتك وباقاتك في <span>{settings.store_name || 'chrigsm'}</span></h1>
            <p>اختر الأداة أولاً، ثم حدّد الباقة المناسبة—مدة، تجديد، رصيد أو خدمة محددة—من شاشة واحدة واضحة في chrigsm.</p>
            <div className="hero-cta">
              <Link to="/shop" className="btn btn-light btn-lg">استعرض الأدوات</Link>
              <a className="btn btn-ghost btn-lg" href="#featured">الأدوات المختارة</a>
            </div>
            <div className="hero-stats">
              <div><b>{tools.length || '—'}</b><span>أداة متاحة</span></div>
              <div><b>{categories.length || '—'}</b><span>تصنيف خدمة</span></div>
              <div><b>24/7</b><span>متابعة الطلبات</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="cat-chips">
            <Link to="/shop" className="chip active">كل الأدوات</Link>
            {categories.slice(0, 12).map((category) => (
              <Link key={category.id} to={`/shop?category=${category.id}`} className="chip">
                {category.emoji} {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 ? <HScroll title="أدوات مختارة" emoji="⚡" tools={featured} /> : null}

      {categories.map((category) => {
        const items = toolsByCategory.get(category.id) || [];
        if (!items.length) return null;
        return <HScroll key={category.id} title={category.name} emoji={category.emoji} tools={items.slice(0, 12)} />;
      })}

      <section className="home-section" id="featured">
        <div className="container">
          <div className="banner-strip">
            <div>
              <h3>صورة واحدة، باقات متعددة</h3>
              <p>كل أداة تجمع باقاتها في صفحة واحدة؛ لا تتكرر الهوية البصرية عند اختلاف المدة أو الرصيد.</p>
            </div>
            <Link to="/shop" className="btn btn-light">ابدأ الاختيار</Link>
          </div>
        </div>
      </section>

      <section className="home-section how-section">
        <div className="container">
          <h2 className="center-title">كيف تختار خدمتك؟</h2>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><h4>اختر الأداة</h4><p>استعرض الأدوات حسب التصنيف</p></div>
            <div className="step"><div className="step-num">2</div><h4>اختر الباقة</h4><p>حدد المدة أو التجديد أو الرصيد</p></div>
            <div className="step"><div className="step-num">3</div><h4>أدخل بيانات الخدمة</h4><p>تظهر الحقول المطلوبة لكل باقة</p></div>
            <div className="step"><div className="step-num">4</div><h4>تابع الطلب</h4><p>تصل التحديثات إلى حسابك</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}
