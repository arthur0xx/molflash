import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, user } = useApp();
  const [data, setData] = useState(null);
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/products/${id}`).then(setData).catch(e => setErr(e.message));
    setQty(1);
  }, [id]);

  if (err) return <div className="container"><p className="error-txt">{err}</p></div>;
  if (!data) return <div className="container"><p className="muted">جارٍ التحميل...</p></div>;

  const { product, related } = data;
  const save = product.old_price > product.price ? Math.round((1 - product.price / product.old_price) * 100) : 0;

  const orderNow = () => {
    if (!user) return navigate('/login');
    addToCart(product, qty);
    navigate('/checkout');
  };

  return (
    <div className="container product-page">
      <div className="product-detail">
        <div className="pd-visual" style={{ background: product.gradient }}>
          <span className="pd-emoji">{product.emoji}</span>
          {save > 0 && <span className="discount-badge">خصم {save}%</span>}
        </div>
        <div className="pd-info">
          <Link to={`/shop?category=${product.category_id}`} className="cat-name">{product.category_name}</Link>
          <h1>{product.name}</h1>
          <p className="pd-desc">{product.description}</p>
          <div className="pd-price">
            <b>{product.price} درهم</b>
            {product.old_price > product.price && <del>{product.old_price} درهم</del>}
          </div>
          <div className="pd-meta">
            <span>✅ تسليم فوري</span>
            <span>🛡️ ضمان</span>
            <span>⭐ {product.sold_count} عملية</span>
          </div>
          <div className="qty-row">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
            <b>{qty}</b>
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <div className="pd-actions">
            <button className="btn btn-primary btn-lg" onClick={orderNow}>اطلب الآن</button>
            <button className="btn btn-outline btn-lg" onClick={() => addToCart(product, qty)}>أضف للسلة +</button>
          </div>
          {!user && <p className="muted">⚠️ يجب تسجيل الدخول لإتمام الطلب — <Link to="/login">دخول</Link></p>}
          <div className="pd-note">💡 بعد الشراء تصل معلومات التفعيل في <b>صفحة حسابك</b> وتُرسل أيضاً عبر <b>واتساب</b>.</div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="home-section">
          <div className="section-head"><h2>منتجات مشابهة</h2></div>
          <div className="h-scroll">{related.map(p => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
