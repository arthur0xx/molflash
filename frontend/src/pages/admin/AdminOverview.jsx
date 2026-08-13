import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const money = (value) => `${Number(value || 0).toLocaleString('fr-MA', { maximumFractionDigits: 2 })} د.م.`;

function statusLabel(status) {
  if (status === 'success') return 'مكتمل';
  if (status === 'rejected') return 'مرفوض';
  return 'قيد المعالجة';
}

export default function AdminOverview({ go }) {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [walletRequests, setWalletRequests] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [nextStats, nextOrders, nextWalletRequests] = await Promise.all([
        api('/admin/stats'),
        api('/admin/orders?status=pending'),
        api('/admin/wallet/requests'),
      ]);
      setStats(nextStats);
      setOrders(nextOrders);
      setWalletRequests(nextWalletRequests);
    } catch (err) {
      setError(err.message || 'تعذر تحميل بيانات لوحة التحكم');
    }
  };

  useEffect(() => { load(); }, []);

  if (!stats && !error) return <p className="muted">جارٍ تحميل ملخص العمليات…</p>;

  const cards = [
    { label: 'طلبيات قيد المعالجة', value: stats?.pending || 0, note: 'تحتاج متابعة', action: () => go('orders'), tone: 'blue' },
    { label: 'إجمالي أرصدة العملاء', value: money(stats?.walletBalances), note: 'داخل المحافظ', action: () => go('users'), tone: 'green' },
    { label: 'طلبات تعبئة معلّقة', value: stats?.pendingWallet || 0, note: 'بانتظار المراجعة', action: () => go('wallet'), tone: 'amber' },
    { label: 'إجمالي المنتجات', value: stats?.products || 0, note: 'ضمن مجلدات التصنيفات', action: () => go('products'), tone: 'slate' },
  ];

  return (
    <div className="admin-panel admin-overview">
      <div className="admin-heading admin-overview-heading">
        <div>
          <div className="eyebrow">ChriGsm CMC</div>
          <h1>نظرة عامة</h1>
          <p className="muted">متابعة مختصرة للطلبات التي تحتاج إجراء، أرصدة العملاء، وحركة التعبئة.</p>
        </div>
        <div className="admin-heading-actions">
          <button className="btn btn-outline btn-sm" onClick={load}>تحديث البيانات</button>
          <button className="btn btn-primary btn-sm" onClick={() => go('products')}>إضافة منتج</button>
        </div>
      </div>

      {error && <p className="error-txt">{error}</p>}

      <div className="overview-stat-grid">
        {cards.map((card) => (
          <button className={`overview-stat-card ${card.tone}`} key={card.label} onClick={card.action}>
            <span>{card.label}</span>
            <b>{card.value}</b>
            <small>{card.note}</small>
          </button>
        ))}
      </div>

      <div className="overview-columns">
        <section className="admin-surface pending-orders-surface">
          <div className="section-head">
            <div><h2>الطلبيات قيد المعالجة</h2><p className="muted small">افتح الطلب لمعالجة البيانات وإرسال التحديث للعميل.</p></div>
            <button className="btn btn-outline btn-sm" onClick={() => go('orders')}>عرض جميع الطلبات</button>
          </div>
          <div className="overview-list">
            {orders.slice(0, 6).map((order) => (
              <button className="overview-list-row" key={order.id} onClick={() => go('orders')}>
                <span className="order-reference">#{order.id}</span>
                <span className="overview-list-copy"><b>{order.user_name || 'عميل'}</b><small>{order.items?.length || 0} خدمة · {order.created_at}</small></span>
                <strong>{money(order.total)}</strong>
                <span className={`status-pill ${order.status || 'pending'}`}>{statusLabel(order.status)}</span>
              </button>
            ))}
            {!orders.length && <p className="muted empty-inline">لا توجد طلبيات قيد المعالجة حاليًا.</p>}
          </div>
        </section>

        <section className="admin-surface wallet-summary-surface">
          <div className="section-head">
            <div><h2>طلبات تعبئة بانتظار المراجعة</h2><p className="muted small">تأكد من التحويل قبل إضافة الرصيد إلى المحفظة.</p></div>
            <button className="btn btn-outline btn-sm" onClick={() => go('wallet')}>إدارة التعبئة</button>
          </div>
          <div className="overview-list compact">
            {walletRequests.slice(0, 5).map((request) => (
              <button className="overview-list-row" key={request.id} onClick={() => go('wallet')}>
                <span className="overview-list-copy"><b>{request.user_name || 'عميل'}</b><small>{request.method === 'crypto' ? 'عملة رقمية' : 'تحويل بنكي'}{request.ref ? ` · ${request.ref}` : ''}</small></span>
                <strong>{money(request.amount)}</strong>
              </button>
            ))}
            {!walletRequests.length && <p className="muted empty-inline">لا توجد طلبات تعبئة معلّقة.</p>}
          </div>
          <div className="overview-balance-box">
            <span>رصيد المحافظ الإجمالي</span>
            <b>{money(stats?.walletBalances)}</b>
            <button className="btn btn-primary btn-sm" onClick={() => go('users')}>إدارة الأرصدة</button>
          </div>
        </section>
      </div>
    </div>
  );
}
