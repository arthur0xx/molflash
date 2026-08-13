import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import { productPrice } from '../components/ProductCard.jsx';
import { CartIcon, TrashIcon } from '../components/CartIcons.jsx';

const serviceGlyph = { ACTIVATION: '⌁', SERVER: '◈', RENTAL: '◷', MISC: '✦' };

export default function Cart() {
  const { cart, updateQty, user } = useApp();
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  if (!cart.length) {
    return (
      <main className="app-page"><div className="app-container empty-cart"><span className="empty-cart-icon"><CartIcon size={28} /></span><h1>سلة المشتريات فارغة</h1><p>أضف خدمة من الكاتالوغ لتظهر هنا.</p><Link to="/shop" className="primary-link">تصفح الكاتالوغ</Link></div></main>
    );
  }

  return (
    <main className="app-page cart-app-page">
      <div className="app-container">
        <div className="cart-heading">
          <button type="button" className="back-link cart-back" onClick={() => navigate(-1)}>→</button>
          <h1>سلة المشتريات</h1>
        </div>
        <section className="cart-app-list">
          {cart.map((item) => (
            <article className="cart-app-item" key={item.product_id}>
              <span className="cart-service-icon">{serviceGlyph[item.service_type] || item.emoji || '◈'}</span>
              <div className="cart-item-copy">
                <Link to={`/product/${item.product_id}`}><b>{item.name}</b></Link>
                <small>خدمة رقمية</small>
                <button type="button" className="cart-remove" aria-label={`حذف ${item.name}`} onClick={() => updateQty(item.product_id, 0)}><TrashIcon /></button>
              </div>
              <div className="cart-price-block"><strong>{productPrice(item.price)}</strong><div className="quantity-control"><button type="button" aria-label="تقليل الكمية" onClick={() => updateQty(item.product_id, item.quantity - 1)}>−</button><b>{item.quantity}</b><button type="button" aria-label="زيادة الكمية" onClick={() => updateQty(item.product_id, item.quantity + 1)}>+</button></div></div>
            </article>
          ))}
        </section>
      </div>
      <div className="sticky-order-bar cart-total-bar"><div><small>إجمالي السلة</small><b>{productPrice(total)}</b></div><button type="button" onClick={() => user ? navigate('/checkout') : navigate('/login')}><CartIcon size={18} />إتمام الطلب</button></div>
    </main>
  );
}
