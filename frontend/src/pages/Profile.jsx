import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import { api, waOpen } from '../api.js';

const STATUS = {
  pending: { text: 'قيد المعالجة', cls: 'pending' },
  success: { text: 'تم التسليم ✅', cls: 'success' },
  rejected: { text: 'مرفوض ❌', cls: 'rejected' },
};

export default function Profile() {
  const { user, refreshUser, notifications, loadNotifications } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(params.get('tab') || 'overview');
  const [orders, setOrders] = useState([]);
  const [txns, setTxns] = useState([]);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    refreshUser();
    loadNotifications();
    api('/orders').then(setOrders).catch(() => {});
    api('/wallet').then(d => setTxns(d.transactions)).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    setParams({ tab });
  }, [tab]);

  if (!user) { navigate('/login'); return null; }

  const redeem = async () => {
    setErr(''); setMsg('');
    try {
      const d = await api('/wallet/voucher', { method: 'POST', body: { code } });
      setMsg(d.message); setCode('');
      refreshUser(); api('/wallet').then(r => setTxns(r.transactions));
    } catch (e) { setErr(e.message); }
  };

  const bankReq = async () => {
    setErr(''); setMsg('');
    try {
      const d = await api('/wallet/bank-request', { method: 'POST', body: { amount, method, ref } });
      setMsg(d.message); setAmount(''); setRef('');
      if (d.wa_link) waOpen(d.wa_link);
    } catch (e) { setErr(e.message); }
  };

  const markRead = async () => {
    await api('/notifications/read', { method: 'POST' });
    loadNotifications();
  };

  const waOrder = (o) => {
    const items = o.items_text || '';
    waOpen(`https://wa.me/212600000000?text=${encodeURIComponent(
      `مرحباً، لدي استفسار عن طلبي #${o.id}\n${items}\nالحالة: ${o.status_text}`)}`);
  };

  return (
    <div className="container profile-page">
      <div className="profile-head">
        <div className="avatar">👤</div>
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.phone}</p>
        </div>
        <div className="profile-balance">
          <small>رصيد المحفظة</small>
          <b>💳 {user.balance} درهم</b>
        </div>
      </div>

      <div className="tabs">
        {[['overview', 'الرئيسية'], ['orders', 'طلباتي'], ['wallet', 'المحفظة'], ['notifications', `الإشعارات${notifications.filter(n => !n.is_read).length ? ' 🔴' : ''}`]].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'overview' && (
          <div className="overview-grid">
            <div className="ov-card" onClick={() => setTab('orders')}>
              <b>{orders.length}</b><span>طلباتي</span>
            </div>
            <div className="ov-card" onClick={() => setTab('wallet')}>
              <b>{user.balance}</b><span>رصيدي (درهم)</span>
            </div>
            <div className="ov-card" onClick={() => setTab('notifications')}>
              <b>{notifications.filter(n => !n.is_read).length}</b><span>إشعارات جديدة</span>
            </div>
            <div className="ov-card" onClick={() => api('/orders').then(o => o[0] && waOrder(o[0]))}>
              <b>💬</b><span>تواصل واتساب</span>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="orders-list">
            {orders.length === 0 && <div className="empty"><p>لا توجد طلبات بعد</p></div>}
            {orders.map(o => (
              <div className="order-card" key={o.id}>
                <div className="order-top">
                  <b>طلب #{o.id}</b>
                  <span className={`status-pill ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.text}</span>
                </div>
                <div className="order-items">{o.items.map(i => <span key={i.id}>• {i.name} ×{i.quantity}</span>)}</div>
                <div className="order-bottom">
                  <span className="muted">{o.created_at.replace('T', ' ')}</span>
                  <b>{o.total} درهم</b>
                  <button className="btn btn-outline btn-sm" onClick={() => waOrder(o)}>💬 واتساب</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'wallet' && (
          <div className="wallet-layout">
            <div className="wallet-recharge">
              <div className="balance-hero">💳 {user.balance} <small>درهم</small></div>
              <h3>طريقة 1: كود تعبئة فوري</h3>
              <div className="flex-row">
                <input className="input" placeholder="أدخل الكود (مثال: TARBIB-20)" value={code} onChange={e => setCode(e.target.value)} />
                <button className="btn btn-primary" onClick={redeem}>تفعيل</button>
              </div>
              <h3>طريقة 2: تحويل بنكي / عملة رقمية</h3>
              <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="bank">تحويل بنكي</option>
                <option value="crypto">عملة رقمية (USDT/TRC20)</option>
              </select>
              <input className="input" type="number" placeholder="المبلغ بالدرهم" value={amount} onChange={e => setAmount(e.target.value)} />
              <input className="input" placeholder="مرجع التحويل / رقم العملية (اختياري)" value={ref} onChange={e => setRef(e.target.value)} />
              <button className="btn btn-outline btn-block" onClick={bankReq}>إرسال طلب التعبئة</button>
              {msg && <p className="ok-txt">{msg}</p>}
              {err && <p className="error-txt">{err}</p>}
              <p className="muted small">🧾 أرسل إثبات التحويل واتساب بعد الطلب لتسريع الموافقة.</p>
            </div>
            <div className="wallet-history">
              <h3>سجل المحفظة</h3>
              {txns.length === 0 && <p className="muted">لا توجد عمليات</p>}
              {txns.map(t => (
                <div className="txn" key={t.id}>
                  <div>
                    <b>{t.description}</b>
                    <span className="muted small">{t.created_at}</span>
                  </div>
                  <span className={t.amount > 0 ? 'pos' : 'neg'}>
                    {t.amount > 0 ? '+' : ''}{t.amount} درهم
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="notif-list">
            <button className="btn btn-outline btn-sm" onClick={markRead}>تحديد الكل كمقروء</button>
            {notifications.length === 0 && <div className="empty"><p>لا توجد إشعارات</p></div>}
            {notifications.map(n => (
              <div className={`notif ${n.is_read ? '' : 'unread'}`} key={n.id}>
                <b>{n.title}</b>
                <p>{n.body}</p>
                <span className="muted small">{n.created_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
