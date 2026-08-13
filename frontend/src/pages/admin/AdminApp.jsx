import { useEffect, useState } from 'react';
import { useApp } from '../../context.jsx';
import { api, waOpen } from '../../api.js';
import { login as doLogin } from './adminAuth.js';
import AdminOverview from './AdminOverview.jsx';
import AdminProducts from './AdminProducts.jsx';
import AdminCategories from './AdminCategories.jsx';

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

const ADMIN_NAV = [
  ['dashboard', 'نظرة عامة', '⌂'],
  ['orders', 'الطلبات', '▱'],
  ['categories', 'التصنيفات', '□'],
  ['products', 'المنتجات', '◇'],
  ['tools', 'الأدوات والباقات', '◈'],
  ['users', 'العملاء', '♙'],
  ['wallet', 'المحفظة', '◌'],
  ['vouchers', 'أكواد التعبئة', '⌘'],
  ['settings', 'الإعدادات', '⚙'],
];

export default function AdminApp() {
  const { user, loading } = useApp();
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const chooseTab = (nextTab) => { setTab(nextTab); setSidebarOpen(false); };
  const searchCatalog = (event) => {
    event.preventDefault();
    chooseTab('products');
  };

  if (loading) return <div className="container"><p className="muted">...</p></div>;
  if (!user) return <AdminLogin />;
  if (user.role !== 'admin') return <div className="container empty"><p>هذه الصفحة للإدارة فقط</p></div>;

  return (
    <div className="admin-shell" dir="rtl">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <button className="admin-menu-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="إظهار القائمة">☰</button>
          <button className="admin-wordmark" onClick={() => chooseTab('dashboard')}><b>ChriGsm</b> <span>CMC</span></button>
        </div>
        <form className="admin-global-search" onSubmit={searchCatalog}>
          <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="البحث في المنتجات والخدمات…" aria-label="البحث في الكتالوج" />
          <button type="submit" aria-label="بحث">⌕</button>
        </form>
        <div className="admin-topbar-account">
          <button className="admin-utility" aria-label="المساعدة">?</button>
          <button className="admin-utility" aria-label="الإشعارات">♧</button>
          <div className="admin-account-chip"><span className="admin-avatar">{String(user.name || 'A').trim().slice(0, 1)}</span><span>{user.name || 'admin'}</span></div>
        </div>
      </header>

      <div className="admin-app">
        <main className="admin-main">
          {tab === 'dashboard' && <AdminOverview go={chooseTab} />}
          {tab === 'tools' && <Tools go={chooseTab} />}
          {tab === 'products' && <AdminProducts globalSearch={globalSearch} />}
          {tab === 'categories' && <AdminCategories />}
          {tab === 'orders' && <Orders />}
          {tab === 'users' && <Users />}
          {tab === 'wallet' && <WalletReq />}
          {tab === 'vouchers' && <Vouchers />}
          {tab === 'settings' && <Settings />}
        </main>
        <aside className={`admin-side ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="admin-side-label">إدارة المتجر</div>
          <nav aria-label="تنقل لوحة الإدارة">
            {ADMIN_NAV.map(([key, label, icon]) => (
              <button key={key} className={`admin-tab ${tab === key ? 'active' : ''}`} onClick={() => chooseTab(key)}><span className="admin-nav-glyph" aria-hidden="true">{icon}</span>{label}</button>
            ))}
          </nav>
          <a href="/" className="admin-store-link" target="_self">↗ العودة إلى المتجر</a>
        </aside>
      </div>
    </div>
  );
}

function Dashboard({ go }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <p className="muted">...</p>;
  const cards = [
    ['👥', s.users, 'زبون', () => go('users')],
    ['🧰', s.tools, 'أداة', () => go('tools')],
    ['📦', s.products, 'باقة', () => go('products')],
    ['🖼️', s.readyAssets + ' / ' + (s.readyAssets + s.pendingAssets), 'صور الأدوات', () => go('tools')],
    ['📋', s.orders, 'طلب', () => go('orders')],
    ['💰', s.revenue + ' د.م.', 'إيرادات', () => go('orders')],
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

function Tools({ go }) {
  const [tools, setTools] = useState([]);
  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api('/admin/tools').then(setTools).catch((e) => setErr(e.message));
    api('/admin/categories').then(setCats).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openTool = async (toolKey) => {
    setErr(''); setMsg('');
    try {
      const data = await api(`/admin/tools/${encodeURIComponent(toolKey)}`);
      setSelected(data);
      setForm({
        tool_name: data.tool.tool_name || '',
        category_id: String(data.tool.category_id || ''),
        asset_status: data.tool.asset_status === 'ready' ? 'ready' : 'none',
        asset_path: data.tool.asset_path?.startsWith('/assets/') ? data.tool.asset_path : '',
        is_featured: !!data.tool.is_featured,
        is_active: !!data.tool.is_active,
      });
    } catch (e) { setErr(e.message); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!selected || !form) return;
    setSaving(true); setErr(''); setMsg('');
    try {
      await api(`/admin/tools/${encodeURIComponent(selected.tool.tool_key)}`, { method: 'PUT', body: form });
      setMsg('تم حفظ بيانات الأداة وتطبيقها على جميع باقاتها.');
      await openTool(selected.tool.tool_key);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const exportAssetQueue = async () => {
    setErr(''); setMsg('');
    try {
      const queue = await api('/admin/tools/assets/queue');
      const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'chrigsm-tools-needing-images.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setMsg(`تم تصدير ${queue.total} أداة تحتاج مراجعة صورة.`);
    } catch (e) { setErr(e.message); }
  };

  const visible = tools.filter((tool) => {
    const matchesSearch = `${tool.tool_name} ${tool.category_name}`.toLowerCase().includes(q.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'ready' ? tool.asset_status === 'ready' : tool.asset_status !== 'ready');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="admin-panel tools-panel">
      <div className="admin-heading">
        <div><div className="eyebrow">كتالوج chrigsm</div><h1>الأدوات والباقات</h1><p className="muted">صورة واحدة لكل أداة، ثم باقاتها ومددها داخلها.</p></div>
        <div className="admin-heading-actions"><button className="btn btn-outline btn-sm" onClick={exportAssetQueue}>تصدير الصور الناقصة</button><button className="btn btn-outline btn-sm" onClick={load}>تحديث القائمة</button></div>
      </div>
      <div className="tool-admin-controls">
        <input className="input" placeholder="ابحث عن أداة…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filter-row">
          {[['all', 'كل الأدوات'], ['ready', 'بصورة جاهزة'], ['default', 'تحتاج صورة']].map(([key, label]) => (
            <button key={key} className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>
      {err && <p className="error-txt">{err}</p>}
      <div className="tools-admin-layout">
        <div className="tool-admin-list">
          <p className="muted small">{visible.length} أداة معروضة</p>
          {visible.map((tool) => (
            <button key={tool.tool_key} className={`tool-admin-card ${selected?.tool?.tool_key === tool.tool_key ? 'selected' : ''}`} onClick={() => openTool(tool.tool_key)}>
              {tool.asset_status === 'ready' && tool.asset_path ? <img src={tool.asset_path} alt="" /> : <span className="tool-admin-icon" aria-hidden="true">◈</span>}
              <span className="tool-admin-copy"><b>{tool.tool_name}</b><small>{tool.category_name} · {tool.package_count} باقات · من {tool.price} د.م.</small></span>
              <span className={`asset-status ${tool.asset_status === 'ready' ? 'ready' : 'default'}`}>{tool.asset_status === 'ready' ? 'صورة جاهزة' : 'بدون صورة'}</span>
            </button>
          ))}
          {!visible.length && <div className="empty"><p>لا توجد أدوات مطابقة.</p></div>}
        </div>
        <div className="tool-admin-detail">
          {!selected || !form ? <div className="empty"><p>اختر أداة من القائمة لإدارة صورتها وباقاتها.</p></div> : (
            <>
              <div className="tool-admin-preview">
                {form.asset_status === 'ready' && form.asset_path ? <img src={form.asset_path} alt="معاينة الأداة" /> : <div className="admin-empty-preview" aria-label="لا توجد صورة للمنتج">◈</div>}
                <div><span className="asset-status ready">{selected.tool.package_count} باقات</span><h2>{selected.tool.tool_name}</h2><p className="muted">تغييرات هذه الشاشة تُطبق على الأداة فقط، لا على أسعار الباقات أو حقولها.</p></div>
              </div>
              <form className="admin-form tool-edit-form" onSubmit={save}>
                <label className="field-label">اسم الأداة الموحد</label>
                <input className="input" value={form.tool_name} onChange={(e) => setForm({ ...form, tool_name: e.target.value })} required />
                <label className="field-label">التصنيف</label>
                <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select>
                <label className="field-label">مصدر الصورة</label>
                <select className="input" value={form.asset_status} onChange={(e) => setForm({ ...form, asset_status: e.target.value })}><option value="none">بدون صورة</option><option value="ready">إضافة صورة اختيارية</option></select>
                {form.asset_status === 'ready' && <><label className="field-label">مسار الصورة أو رابطها</label><input className="input" dir="ltr" value={form.asset_path} onChange={(e) => setForm({ ...form, asset_path: e.target.value })} placeholder="/assets/products/example.png أو رابط صورة" required /><p className="muted small">إضافة الصورة اختيارية؛ تبقى بطاقات المتجر أيقونية عندما لا توجد صورة.</p></>}
                <label className="check"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> تظهر ضمن الأدوات المختارة</label>
                <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> الأداة متاحة للزبائن</label>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ بيانات الأداة'}</button>
                <button type="button" className="btn btn-outline" onClick={() => go('products')}>إدارة الباقات الفردية</button>
                {msg && <p className="ok-txt">{msg}</p>}
              </form>
              <div className="tool-package-list">
                <div className="section-head"><h3>باقات الأداة</h3><span className="muted small">يمكن تعديل السعر والحقول من تبويب الباقات الفردية.</span></div>
                {selected.packages.map((item) => <div className="tool-package-row" key={item.id}><div><b>{item.package_label || item.name}</b><small>{item.delivery_time || 'حسب الخدمة'} · {(item.fields || []).length} حقول</small></div><strong>{item.price} د.م.</strong></div>)}
              </div>
            </>
          )}
        </div>
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
  useEffect(() => { load(); }, []);

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
        {!editing && <input className="input" name="tool_name" placeholder="اسم الأداة الموحد (مثال: Unlock Tool)" />}
        <input className="input" name="name" placeholder="اسم الباقة أو الخدمة" defaultValue={editing?.name} required />
        <input className="input" name="package_label" placeholder="وسم الباقة (مثال: 6 Hours أو 1 Year)" defaultValue={editing?.package_label || ''} />
        <select className="input" name="category_id" defaultValue={editing?.category_id}>
          {cats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input className="input" type="number" name="price" placeholder="السعر (د.م.)" defaultValue={editing?.price} required />
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
              <span className="muted small">{p.category_name} · {p.price} د.م.{p.old_price ? ` / ${p.old_price}` : ''} · {p.sold_count} بيع</span>
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
  useEffect(() => { load(); }, []);

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
  const [sort, setSort] = useState('newest');
  const load = () => api(`/admin/orders?status=${filter}`).then(setList);
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status) => {
    const d = await api(`/admin/orders/${id}/status`, { method: 'PUT', body: { status } });
    load();
    if (status === 'success' && d.wa_link && confirm('فتح واتساب لإرسال إشعار نجاح الطلب للعميل؟')) waOpen(d.wa_link);
    if (status === 'rejected') alert('تم رفض الطلب وإرجاع المبلغ إلى محفظة العميل.');
  };

  const ordered = [...list].sort((a, b) => {
    if (sort === 'amount') return Number(b.total || 0) - Number(a.total || 0);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  return (
    <div className="admin-panel operational-page orders-page">
      <div className="admin-heading"><div><div className="eyebrow">مركز العمليات</div><h1>إدارة الطلبات</h1><p className="muted">تابع حالة كل خدمة رقمية، راجع معلومات العميل، ثم أرسل نتيجة المعالجة عند التسليم.</p></div><button className="btn btn-outline btn-sm" onClick={load}>تحديث</button></div>
      <div className="operational-filterbar admin-surface">
        <label><span>الحالة</span><select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">كل الطلبات</option><option value="pending">قيد المعالجة</option><option value="success">مكتمل</option><option value="rejected">مرفوض</option></select></label>
        <label><span>ترتيب الوقت</span><select className="input" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">الأحدث أولًا</option><option value="amount">الأعلى سعرًا</option></select></label>
        <div className="operational-filter-note"><b>{ordered.length}</b><span>طلب معروض</span></div>
      </div>
      <div className="order-card-grid">
        {ordered.map((order) => <article className="operational-card order-card" key={order.id}>
          <div className="operational-card-head"><div><b>طلب #{order.id}</b><span>{order.user_name || 'عميل'} · {order.user_phone || 'بدون هاتف'}</span></div><span className={`status-pill ${order.status}`}>{STATUS_AR[order.status] || 'قيد المعالجة'}</span></div>
          <div className="order-service-list">{(order.items || []).map((item) => <div className="order-service-line" key={item.id}><b>{item.name}</b><span>×{item.quantity}</span>{Object.keys(item.answers || {}).length > 0 && <div className="order-answer-summary">{Object.entries(item.answers).slice(0, 2).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</div>}</div>)}</div>
          <div className="operational-card-meta"><span>{order.created_at}</span><b>{Number(order.total || 0).toLocaleString('fr-MA')} د.م.</b></div>
          <div className="operational-card-actions"><button className="btn btn-outline btn-sm" onClick={() => waOpen(`https://wa.me/${String(order.user_phone || '').replace(/\D/g, '')}`)}>واتساب</button><button className="btn btn-success btn-sm" disabled={order.status === 'success'} onClick={() => setStatus(order.id, 'success')}>مكتمل</button><button className="btn btn-warning btn-sm" disabled={order.status === 'pending'} onClick={() => setStatus(order.id, 'pending')}>معالجة</button><button className="btn btn-danger btn-sm" disabled={order.status === 'rejected'} onClick={() => setStatus(order.id, 'rejected')}>رفض</button></div>
        </article>)}
        {!ordered.length && <div className="empty admin-surface"><p>لا توجد طلبات مطابقة للتصفية الحالية.</p></div>}
      </div>
    </div>
  );
}

function Users() {
  const [list, setList] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [sort, setSort] = useState('newest');
  const load = () => api('/admin/users').then(setList);
  useEffect(() => { load(); }, []);

  const adjust = async (user) => {
    const amount = Number(amounts[user.id]);
    if (!amount) return alert('أدخل المبلغ المراد إضافته أو خصمه.');
    const description = amount > 0 ? 'إضافة رصيد من الإدارة' : 'خصم رصيد من الإدارة';
    await api(`/admin/users/${user.id}/balance`, { method: 'POST', body: { amount, description } });
    setAmounts((previous) => ({ ...previous, [user.id]: '' }));
    load();
  };

  const customers = list.filter((user) => user.role === 'customer').sort((a, b) => sort === 'balance' ? Number(b.balance || 0) - Number(a.balance || 0) : String(b.created_at || '').localeCompare(String(a.created_at || '')));

  return (
    <div className="admin-panel operational-page clients-page">
      <div className="admin-heading"><div><div className="eyebrow">ملفات العملاء والمحافظ</div><h1>إدارة العملاء</h1><p className="muted">راجِع الرصيد، الطلبات، ووسيلة التواصل قبل تعديل المحفظة أو حالة الحساب.</p></div><button className="btn btn-outline btn-sm" onClick={load}>تحديث</button></div>
      <div className="operational-filterbar admin-surface client-filterbar"><label><span>ترتيب العملاء</span><select className="input" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">الأحدث أولًا</option><option value="balance">الأعلى رصيدًا</option></select></label><div className="operational-filter-note"><b>{customers.length}</b><span>عميل</span></div></div>
      <div className="client-card-grid">
        {customers.map((user) => <article className="operational-card client-card" key={user.id}>
          <div className="client-card-head"><span className="client-avatar">{String(user.name || 'ع').trim().slice(0, 1)}</span><div><b>{user.name}</b><a href={`https://wa.me/${String(user.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">◉ {user.phone || 'بدون هاتف'}</a></div></div>
          <div className="client-balance"><span>رصيد المحفظة</span><b>{Number(user.balance || 0).toLocaleString('fr-MA')} د.م.</b></div>
          <div className="client-meta"><span>{user.orders_count || 0} طلب</span><span>{user.is_active ? 'حساب نشط' : 'حساب معطّل'}</span></div>
          <div className="client-adjust"><input className="input input-sm" type="number" placeholder="± مبلغ د.م." value={amounts[user.id] || ''} onChange={(event) => setAmounts({ ...amounts, [user.id]: event.target.value })} /><button className="btn btn-primary btn-sm" onClick={() => adjust(user)}>تعديل الرصيد</button></div>
          <div className="operational-card-actions"><a className="btn btn-outline btn-sm" href={`https://wa.me/${String(user.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">واتساب</a><button className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}`} onClick={async () => { await api(`/admin/users/${user.id}/toggle`, { method: 'POST' }); load(); }}>{user.is_active ? 'تعطيل' : 'تفعيل'}</button></div>
        </article>)}
        {!customers.length && <div className="empty admin-surface"><p>لا يوجد عملاء مسجلون بعد.</p></div>}
      </div>
    </div>
  );
}

function WalletReq() {
  const [list, setList] = useState([]);
  const load = () => api('/admin/wallet/requests').then(setList);
  useEffect(() => { load(); }, []);
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
            <b className="pos">+{w.amount} د.م.</b>
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
  useEffect(() => { load(); }, []);

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
            <b>{v.amount} د.م.</b>
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
        <label className="field-label">عملة العرض</label>
        <select className="input" name="currency" defaultValue="MAD"><option value="MAD">الدرهم المغربي (د.م.)</option></select>
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
