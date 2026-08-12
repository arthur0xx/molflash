import { useEffect, useState } from 'react';
import { useApp } from '../../context.jsx';
import { api, waOpen } from '../../api.js';
import { login as doLogin } from './adminAuth.js';

const STATUS_AR = { pending: 'قيد المعالجة', success: 'تم التسليم ✅', rejected: 'مرفوض ❌' };

function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await doLogin(phone, password);
      window.location.reload();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container auth-wrap">
      <div className="auth-card admin-login-card">
        <h1>🔐 لوحة التحكم</h1>
        <p className="muted">منطقة خاصة بالإدارة فقط</p>
        <form onSubmit={submit}>
          <input className="input" placeholder="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} required />
          <input className="input" type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error-txt">{err}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? '...' : 'دخول'}</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { user, loading } = useApp();
  const [tab, setTab] = useState('dashboard');

  if (loading) return <div className="container"><p className="muted">...</p></div>;
  if (!user) return <AdminLogin />;
  if (user.role !== 'admin') return <div className="container empty"><p>هذه الصفحة للإدارة فقط</p></div>;

  return (
    <div className="admin-app">
      <aside className="admin-side">
        <div className="admin-brand">⚡ <b>التحكم</b></div>
        <nav>
          {[
            ['dashboard', '📊 لوحة المعلومات'],
            ['products', '📦 المنتجات'],
            ['categories', '🏷️ التصنيفات'],
            ['orders', '📋 الطلبات'],
            ['users', '👥 الزبناء'],
            ['wallet', '💰 طلبات التعبئة'],
            ['vouchers', '🎟️ أكواد التعبئة'],
            ['settings', '⚙️ الإعدادات'],
          ].map(([k, l]) => (
            <button key={k} className={`admin-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <a href="/" className="btn btn-outline btn-sm" target="_self">← العودة للمتجر</a>
      </aside>
      <main className="admin-main">
        {tab === 'dashboard' && <Dashboard go={setTab} />}
        {tab === 'products' && <Products />}
        {tab === 'categories' && <Categories />}
        {tab === 'orders' && <Orders />}
        {tab === 'users' && <Users />}
        {tab === 'wallet' && <WalletReq />}
        {tab === 'vouchers' && <Vouchers />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

function Dashboard({ go }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <p className="muted">...</p>;
  const cards = [
    ['👥', s.users, 'زبون', () => go('users')],
    ['📦', s.products, 'منتج', () => go('products')],
    ['📋', s.orders, 'طلب', () => go('orders')],
    ['💰', s.revenue + ' درهم', 'إيرادات', () => go('orders')],
    ['⏳', s.pending, 'طلبات قيد المعالجة', () => go('orders')],
    ['🆕', s.today, 'طلبات اليوم', () => go('orders')],
    ['💳', s.pendingWallet, 'تعبئة بانتظار الموافقة', () => go('wallet')],
  ];
  return (
    <div className="admin-dash">
      <h1>لوحة المعلومات</h1>
      <div className="dash-grid">
        {cards.map(([e, v, l, cb], i) => (
          <div className="dash-card" key={i} onClick={cb}>
            <span className="dash-emoji">{e}</span>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Products() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState([]);
  const load = () => { api('/admin/products').then(setList); api('/admin/categories').then(setCats); };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const body = {
      ...form, price: Number(form.price), old_price: form.old_price ? Number(form.old_price) : null,
      fields: fields.map(f => ({ label: f.label, type: f.type, required: f.required })),
    };
    if (editing) await api(`/admin/products/${editing.id}`, { method: 'PUT', body });
    else await api('/admin/products', { method: 'POST', body });
    setEditing(null); setFields([]); load();
  };

  const editProduct = (p) => {
    setEditing(p);
    setFields((p.fields || []).map(f => ({ label: f.label, type: f.type, required: !!f.required })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateField = (i, patch) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const addField = () => setFields(prev => [...prev, { label: '', type: 'text', required: true }]);
  const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="admin-panel">
      <h1>المنتجات</h1>
      <form className="admin-form" onSubmit={save}>
        <input className="input" name="name" placeholder="اسم المنتج" defaultValue={editing?.name} required />
        <select className="input" name="category_id" defaultValue={editing?.category_id}>
          {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input className="input" type="number" name="price" placeholder="السعر" defaultValue={editing?.price} required />
        <input className="input" type="number" name="old_price" placeholder="السعر قبل الخصم (اختياري)" defaultValue={editing?.old_price || ''} />
        <input className="input" name="emoji" placeholder="إيموجي" defaultValue={editing?.emoji || '🎁'} />
        <textarea className="input" name="description" rows="2" placeholder="الوصف" defaultValue={editing?.description} />
        <label className="check"><input type="checkbox" name="is_featured" defaultChecked={editing?.is_featured} /> مميز</label>
        <label className="check"><input type="checkbox" name="is_active" defaultChecked={editing ? !!editing.is_active : true} /> نشط</label>
        <div className="fields-builder">
          <h4>📝 حقول الخدمة (متطلبات الزبون عند الطلب)</h4>
          <p className="muted small">مثال لمنتج FRP: الجهاز، الموديل، IMEI... أو Email/Password للتفعيلات</p>
          {fields.length === 0 && <p className="muted small">لا توجد حقول — أضف حقولاً إن كانت الخدمة تتطلب بيانات من الزبون.</p>}
          {fields.map((f, i) => (
            <div className="field-row" key={i}>
              <input className="input input-sm" placeholder="اسم الحقل (مثال: رقم IMEI)" value={f.label}
                onChange={e => updateField(i, { label: e.target.value })} />
              <select className="input input-sm" value={f.type} onChange={e => updateField(i, { type: e.target.value })}>
                <option value="text">نص قصير</option>
                <option value="textarea">نص طويل</option>
              </select>
              <label className="check"><input type="checkbox" checked={f.required} onChange={e => updateField(i, { required: e.target.checked })} /> إجباري</label>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeField(i)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={addField}>+ إضافة حقل</button>
        </div>
        <button className="btn btn-primary">{editing ? 'حفظ التعديل' : 'إضافة منتج'}</button>
        {editing && <button type="button" className="btn btn-outline" onClick={() => { setEditing(null); setFields([]); }}>إلغاء</button>}
      </form>

      <div className="admin-table">
        {list.map(p => (
          <div className="admin-row" key={p.id}>
            <span className="row-emoji" style={{ background: p.gradient }}>{p.emoji}</span>
            <div className="row-main">
              <b>{p.name}</b>
              <span className="muted small">{p.category_name} · {p.price} درهم{p.old_price ? ` / ${p.old_price}` : ''} · {p.sold_count} بيع</span>
              {(p.fields || []).length > 0 && (
                <span className="muted small"> · 📝 {(p.fields || []).map(f => f.label).join('، ')}</span>
              )}
            </div>
            <span className={`status-pill ${p.is_active ? 'success' : 'rejected'}`}>{p.is_active ? 'نشط' : 'مخفي'}</span>
            <button className="btn btn-outline btn-sm" onClick={() => editProduct(p)}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={async () => { if (confirm('حذف هذا المنتج؟')) { await api(`/admin/products/${p.id}`, { method: 'DELETE' }); load(); } }}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Categories() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/admin/categories').then(setList);
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const body = { ...form, sort_order: Number(form.sort_order) || 0 };
    try {
      if (editing) await api(`/admin/categories/${editing.id}`, { method: 'PUT', body });
      else await api('/admin/categories', { method: 'POST', body });
      setEditing(null); setErr(''); load();
    } catch (x) { setErr(x.message); }
  };

  return (
    <div className="admin-panel">
      <h1>التصنيفات</h1>
      <form className="admin-form" onSubmit={save}>
        <input className="input" name="name" placeholder="اسم التصنيف" defaultValue={editing?.name} required />
        <input className="input" name="emoji" placeholder="إيموجي" defaultValue={editing?.emoji || '🛍️'} />
        <input className="input" name="sort_order" type="number" placeholder="الترتيب" defaultValue={editing?.sort_order || 0} />
        <button className="btn btn-primary">{editing ? 'حفظ' : 'إضافة تصنيف'}</button>
        {editing && <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>إلغاء</button>}
      </form>
      {err && <p className="error-txt">{err}</p>}
      <div className="admin-table">
        {list.map(c => (
          <div className="admin-row" key={c.id}>
            <span className="row-emoji">{c.emoji}</span>
            <div className="row-main"><b>{c.name}</b><span className="muted small">{c.description}</span></div>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(c)}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={async () => {
              try { await api(`/admin/categories/${c.id}`, { method: 'DELETE' }); load(); }
              catch (x) { alert(x.message); }
            }}>حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Orders() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('all');
  const load = () => api(`/admin/orders?status=${filter}`).then(setList);
  useEffect(load, [filter]);

  const setStatus = async (id, status) => {
    const d = await api(`/admin/orders/${id}/status`, { method: 'PUT', body: { status } });
    load();
    if (status === 'success' && d.wa_link) {
      if (confirm('فتح واتساب لإرسال إشعار نجاح الطلب للزبون؟')) waOpen(d.wa_link);
    }
    if (status === 'rejected') alert('تم رفض الطلب وإرجاع المبلغ لمحفظة الزبون.');
  };

  return (
    <div className="admin-panel">
      <h1>تتبع الطلبات</h1>
      <div className="filter-row">
        {['all', 'pending', 'success', 'rejected'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'الكل' : STATUS_AR[f]}
          </button>
        ))}
      </div>
      <div className="admin-table">
        {list.map(o => (
          <div className="admin-row admin-order" key={o.id}>
            <div className="row-main">
              <b>طلب #{o.id} — {o.user_name} ({o.user_phone})</b>
              <span className="muted small">{o.created_at}</span>
            </div>
            <div className="order-items">
              {o.items && o.items.map(it => (
                <div key={it.id} className="order-item">
                  <b>{it.name} ×{it.quantity}</b>
                  {Object.keys(it.answers || {}).length > 0 && (
                    <div className="order-answers">{Object.entries(it.answers).map(([k, v]) => <span key={k} className="ans-tag">{k}: <b>{v}</b></span>)}</div>
                  )}
                </div>
              ))}
            </div>
            <b>{o.total} درهم</b>
            <span className={`status-pill ${o.status}`}>{o.status_text}</span>
            <div className="status-actions">
              <button className="btn btn-success btn-sm" disabled={o.status === 'success'} onClick={() => setStatus(o.id, 'success')}>ناجح</button>
              <button className="btn btn-warning btn-sm" disabled={o.status === 'pending'} onClick={() => setStatus(o.id, 'pending')}>معالجة</button>
              <button className="btn btn-danger btn-sm" disabled={o.status === 'rejected'} onClick={() => setStatus(o.id, 'rejected')}>رفض</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="muted">لا توجد طلبات</p>}
      </div>
    </div>
  );
}

function Users() {
  const [list, setList] = useState([]);
  const [amounts, setAmounts] = useState({});
  const load = () => api('/admin/users').then(setList);
  useEffect(load, []);

  const adjust = async (u) => {
    const amt = Number(amounts[u.id]);
    if (!amt) return alert('أدخل المبلغ');
    const desc = amt > 0 ? 'إضافة رصيد من الإدارة' : 'خصم رصيد من الإدارة';
    await api(`/admin/users/${u.id}/balance`, { method: 'POST', body: { amount: amt, description: desc } });
    load();
  };

  return (
    <div className="admin-panel">
      <h1>حسابات الزبناء</h1>
      <div className="admin-table">
        {list.filter(u => u.role === 'customer').map(u => (
          <div className="admin-row" key={u.id}>
            <div className="row-main">
              <b>{u.name} ({u.phone})</b>
              <span className="muted small">{u.orders_count} طلب · رصيد {u.balance} درهم</span>
            </div>
            <div className="inline-form">
              <input className="input input-sm" type="number" placeholder="± مبلغ" value={amounts[u.id] || ''} onChange={e => setAmounts({ ...amounts, [u.id]: e.target.value })} />
              <button className="btn btn-primary btn-sm" onClick={() => adjust(u)}>تعديل الرصيد</button>
            </div>
            <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={async () => { await api(`/admin/users/${u.id}/toggle`, { method: 'POST' }); load(); }}>
              {u.is_active ? 'تعطيل' : 'تفعيل'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletReq() {
  const [list, setList] = useState([]);
  const load = () => api('/admin/wallet/requests').then(setList);
  useEffect(load, []);
  return (
    <div className="admin-panel">
      <h1>طلبات التعبئة اليدوية</h1>
      <div className="admin-table">
        {list.length === 0 && <p className="muted">لا توجد طلبات بانتظار المراجعة</p>}
        {list.map(w => (
          <div className="admin-row" key={w.id}>
            <div className="row-main">
              <b>{w.user_name} ({w.user_phone})</b>
              <span className="muted small">{w.method === 'crypto' ? 'عملة رقمية' : 'تحويل بنكي'}{w.ref ? ' · مرجع: ' + w.ref : ''} · {w.created_at}</span>
            </div>
            <b className="pos">+{w.amount} درهم</b>
            <button className="btn btn-success btn-sm" onClick={async () => { await api(`/admin/wallet/requests/${w.id}/approve`, { method: 'POST' }); load(); }}>موافقة</button>
            <button className="btn btn-danger btn-sm" onClick={async () => { await api(`/admin/wallet/requests/${w.id}/reject`, { method: 'POST' }); load(); }}>رفض</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Vouchers() {
  const [list, setList] = useState([]);
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState(1);
  const [generated, setGenerated] = useState([]);
  const load = () => api('/admin/vouchers').then(setList);
  useEffect(load, []);

  const gen = async () => {
    const d = await api('/admin/vouchers/generate', { method: 'POST', body: { amount, count } });
    setGenerated(d.codes); load();
  };

  return (
    <div className="admin-panel">
      <h1>أكواد التعبئة</h1>
      <div className="admin-form">
        <input className="input" type="number" placeholder="قيمة الكود" value={amount} onChange={e => setAmount(e.target.value)} />
        <input className="input" type="number" placeholder="العدد" value={count} onChange={e => setCount(e.target.value)} />
        <button className="btn btn-primary" onClick={gen}>توليد أكواد</button>
      </div>
      {generated.length > 0 && (
        <div className="gen-codes">
          {generated.map((c, i) => <code key={i}>{c}</code>)}
        </div>
      )}
      <div className="admin-table">
        {list.map(v => (
          <div className="admin-row" key={v.id}>
            <b>{v.code}</b>
            <b>{v.amount} درهم</b>
            <span className={`status-pill ${v.used ? 'success' : 'pending'}`}>{v.used ? `مستعمل بواسطة ${v.used_by_name}` : 'غير مستعمل'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const [s, setS] = useState({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { api('/admin/settings').then(setS); }, []);

  const save = async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    await api('/admin/settings', { method: 'PUT', body: form });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="admin-panel">
      <h1>الإعدادات</h1>
      <form className="admin-form" onSubmit={save}>
        <label className="field-label">اسم المتجر</label>
        <input className="input" name="store_name" defaultValue={s.store_name} />
        <label className="field-label">رقم واتساب (مثال: 0612345678)</label>
        <input className="input" name="whatsapp_number" defaultValue={s.whatsapp_number} dir="ltr" />
        <label className="field-label">رابط API الواتساب (اختياري — بوابات مثل GreenAPI / UltraMsg)</label>
        <input className="input" name="whatsapp_api" defaultValue={s.whatsapp_api} dir="ltr" placeholder="https://gateway.../" />
        <label className="field-label">رمز الـ API (Token)</label>
        <input className="input" name="whatsapp_token" defaultValue={s.whatsapp_token} dir="ltr" />
        <button className="btn btn-primary">حفظ الإعدادات</button>
        {saved && <p className="ok-txt">تم الحفظ ✓</p>}
      </form>
      <div className="settings-hint">
        <h3>كيف يعمل الواتساب؟</h3>
        <p>• بدون إعدادات: يفتح المتجر رابط <b>wa.me</b> برسالة جاهزة (يضغط الزبون/المدير للإرسال).</p>
        <p>• مع بوت: اربط <b>رابط API + رمز</b> من أي بوابة واتساب Business API وستُرسل الإشعارات تلقائياً للزبناء (إشعار حالة الطلب، إشعارات التعبئة).</p>
      </div>
    </div>
  );
}
