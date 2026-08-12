import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

function HScroll({ title, emoji, products }) {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-head">
          <h2>{emoji} {title}</h2>
          <Link to="/shop" className="see-all">عرض الكل ←</Link>
        </div>
        <div className="h-scroll">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [cats, setCats] = useState([]);
  const [all, setAll] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api('/products/featured').then(setFeatured).catch(() => {});
    api('/categories').then(setCats).catch(() => {});
    api('/products').then(setAll).catch(() => {});
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  const currency = settings.currency || 'درهم';

  return (
    <div>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <h1>متجر <span>chrigsm</span></h1>
            <p>تفعيلات فورية لعِراق سيرفر وحلا تيك والتطبيقات والألعاب، أكواد تعبئة، واشتراكات — تسليم سريع ودفع آمن عبر محفظتك.</p>
            <div className="hero-cta">
              <Link to="/shop" className="btn btn-light btn-lg">تسوّق الآن</Link>
              <a className="btn btn-ghost btn-lg" href="#featured">منتجات مميزة 🔥</a>
            </div>
            <div className="hero-stats">
              <div><b>+3000</b><span>عملية ناجحة</span></div>
              <div><b>+1200</b><span>زبون</span></div>
              <div><b>24/7</b><span>دعم واتساب</span></div>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="card-float c1">🎮 عراق سيرفر</div>
            <div className="card-float c2">📱 حلا تيك</div>
            <div className="card-float c3">💳 أكواد تعبئة</div>
            <div className="orb o1" />
            <div className="orb o2" />
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="cat-chips">
            <Link to="/shop" className="chip active">الكل</Link>
            {cats.map(c => (
              <Link key={c.id} to={`/shop?category=${c.id}`} className="chip">{c.emoji} {c.name}</Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <HScroll title="الأكثر مبيعاً" emoji="🔥" products={featured} />
      )}

      {cats.map(c => {
        const items = all.filter(p => p.category_id === c.id);
        if (!items.length) return null;
        return <HScroll key={c.id} title={c.name} emoji={c.emoji} products={items} />;
      })}

      <section className="home-section" id="featured">
        <div className="container">
          <div className="banner-strip">
            <div>
              <h3>💳 محفظة ذكية</h3>
              <p>عبّئ محفظتك بأكواد تعبئة فورية، أو عبر تحويل بنكي / عملة رقمية يوافق عليه المدير.</p>
            </div>
            <Link to="/login" className="btn btn-light">بدء الشراء</Link>
          </div>
        </div>
      </section>

      <section className="home-section how-section">
        <div className="container">
          <h2 className="center-title">كيف تشتري؟</h2>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><h4>أنشئ حساباً</h4><p>سجّل برقم هاتفك</p></div>
            <div className="step"><div className="step-num">2</div><h4>عبّئ محفظتك</h4><p>أكواد فورية أو تحويل يدوي</p></div>
            <div className="step"><div className="step-num">3</div><h4>اطلب المنتج</h4><p>أضف للسلة وأكمل الشراء</p></div>
            <div className="step"><div className="step-num">4</div><h4>استلم التفعيل</h4><p>معلومات التفعيل في طلبك وواتساب</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}
