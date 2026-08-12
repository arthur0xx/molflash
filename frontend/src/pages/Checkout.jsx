import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import { api, waOpen } from '../api.js';

export default function Checkout() {
  const { user, cart, clearCart, refreshUser, loadNotifications } = useApp();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  if (!user) { navigate('/login'); return null; }
  if (cart.length === 0 && !done) {
    return <div className="container empty"><p>السلة فارغة</p><button className="btn btn-primary" onClick={() => navigate('/shop')}>تسوّق</button></div>;
  }

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      const res = await api('/orders', { method: 'POST', body: { items, note } });
      setDone(res.order);
      clearCart();
      refreshUser();
      loadNotifications();
      if (res.wa_link) waOpen(res.wa_link);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="container success-wrap">
        <div className="success-card">
          <div className="success-ico">✅</div>
          <h1>تم استلام طلبك!</h1>
          <p>رقم الطلب <b>#{done.id}</b> — الحالة: <span className="status-pill pending">قيد المعالجة</span></p>
          <p className="muted">تم خصم {done.total} درهم من محفظتك. ستتلقى تفاصيل التفعيل في حسابك.</p>
          <button className="btn btn-primary" onClick={() => navigate('/profile?tab=orders')}>متابعة الطلب</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <h1>إتمام الشراء</h1>
      <div className="cart-layout">
        <div className="cart-items">
          <h3>المنتجات</h3>
          {cart.map(i => (
            <div className="cart-item" key={i.product_id}>
              <div className="cart-thumb" style={{ background: i.gradient }}>{i.emoji}</div>
              <div className="cart-info"><h3>{i.name}</h3><b>{i.price} درهم ×{i.quantity}</b></div>
              <b className="cart-line-total">{i.price * i.quantity} درهم</b>
            </div>
          ))}
          <input className="input" placeholder="ملاحظة (اختياري)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <aside className="cart-summary">
          <h3>الدفع من المحفظة</h3>
          <div className="summary-row"><span>رصيدك</span><b>💳 {user.balance} درهم</b></div>
          <div className="summary-row"><span>المجموع</span><b className="total-price">{total} درهم</b></div>
          <div className="summary-row">
            <span>الرصيد بعد الدفع</span>
            <b className={user.balance - total < 0 ? 'neg' : ''}>{user.balance - total} درهم</b>
          </div>
          {user.balance < total && <p className="error-txt">رصيدك غير كافٍ — <button className="link-btn" onClick={() => navigate('/profile?tab=wallet')}>عبّئ محفظتك</button></p>}
          {err && <p className="error-txt">{err}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || user.balance < total} onClick={submit}>
            {busy ? 'جارٍ المعالجة...' : `تأكيد الشراء (${total} درهم)`}
          </button>
          <p className="muted">🔒 دفع آمن، وتُخصم القيمة من محفظتك فقط.</p>
        </aside>
      </div>
    </div>
  );
}
