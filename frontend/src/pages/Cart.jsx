import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import { productPrice } from '../components/ProductCard.jsx';

export default function Cart() {
  const { cart, updateQty, user } = useApp();
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  if (!cart.length) {
    return (
      <main className="app-page"><div className="app-container empty-cart"><span>▢</span><h1>سلة المشتريات فارغة</h1><p>أضف خدمة من الكاتالوغ لتظهر هنا.</p><Link to="/shop" className="primary-link">تصفح الكاتالوغ</Link></div></main>
    );
  }

  return (
    <main className="app-page cart-app-page">
      <div className="app-container">
        <div className="page-heading"><div><span className="page-kicker">ChriGsm</span><h1>سلة المشتريات</h1></div><span className="result-count">{cart.length} خدمات</span></div>
        <section className="cart-app-list">
          {cart.map((item) => (
            <article className="cart-app-item" key={item.product_id}>
              <span className="service-icon">◈</span>
              <div><Link to={`/product/${item.product_id}`}><b>{item.name}</b></Link><small>خدمة رقمية</small><strong>{productPrice(item.price)}</strong></div>
              <div className="quantity-control"><button type="button" onClick={() => updateQty(item.product_id, item.quantity - 1)}>−</button><b>{item.quantity}</b><button type="button" onClick={() => updateQty(item.product_id, item.quantity + 1)}>+</button></div>
            </article>
          ))}
        </section>
      </div>
      <div className="sticky-order-bar cart-total-bar"><div><small>إجمالي السلة</small><b>{productPrice(total)}</b></div><button type="button" onClick={() => user ? navigate('/checkout') : navigate('/login')}>إتمام الطلب</button></div>
    </main>
  );
}
