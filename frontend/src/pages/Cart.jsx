import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';

export default function Cart() {
  const { cart, updateQty, user } = useApp();
  const navigate = useNavigate();
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="container empty">
        <p>سلة التسوق فارغة 🛒</p>
        <Link to="/shop" className="btn btn-primary">تسوّق الآن</Link>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <h1>سلة التسوق</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {cart.map(item => (
            <div className="cart-item" key={item.product_id}>
              <div className="cart-thumb" style={{ background: item.gradient }}>{item.emoji}</div>
              <div className="cart-info">
                <Link to={`/product/${item.product_id}`}><h3>{item.name}</h3></Link>
                <b>{item.price} درهم</b>
              </div>
              <div className="qty-row">
                <button onClick={() => updateQty(item.product_id, item.quantity - 1)}>-</button>
                <b>{item.quantity}</b>
                <button onClick={() => updateQty(item.product_id, item.quantity + 1)}>+</button>
              </div>
              <b className="cart-line-total">{item.price * item.quantity} درهم</b>
            </div>
          ))}
        </div>
        <aside className="cart-summary">
          <h3>ملخص الطلب</h3>
          <div className="summary-row"><span>عدد المنتجات</span><b>{cart.length}</b></div>
          <div className="summary-row"><span>المجموع</span><b className="total-price">{total} درهم</b></div>
          <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/checkout')}>إتمام الشراء</button>
          {!user && <p className="muted">⚠️ ستحتاج لتسجيل الدخول — <Link to="/login">دخول</Link></p>}
        </aside>
      </div>
    </div>
  );
}
