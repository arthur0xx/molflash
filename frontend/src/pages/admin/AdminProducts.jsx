import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';

const money = (value) => `${Number(value || 0).toLocaleString('fr-MA', { maximumFractionDigits: 2 })} د.م.`;

function CategoryIcon({ category }) {
  if (category.icon_url) return <img className="category-folder-image" src={category.icon_url} alt="" />;
  return <span className="category-folder-emoji" aria-hidden="true">{category.emoji || '📁'}</span>;
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [fields, setFields] = useState([]);
  const [openFolders, setOpenFolders] = useState(new Set());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [nextProducts, nextCategories] = await Promise.all([api('/admin/products'), api('/admin/categories')]);
      setProducts(nextProducts);
      setCategories(nextCategories);
      if (!openFolders.size && nextCategories.length) setOpenFolders(new Set([nextCategories[0].id]));
    } catch (err) { setError(err.message || 'تعذر تحميل المنتجات'); }
  };

  useEffect(() => { load(); }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = !query.trim() || `${product.name} ${product.package_label || ''} ${product.tool_name || ''}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === 'all' || (status === 'active' ? !!product.is_active : !product.is_active);
    const price = Number(product.price || 0);
    const matchesPrice = priceFilter === 'all' || (priceFilter === 'free' ? price === 0 : price > 0);
    return matchesQuery && matchesStatus && matchesPrice;
  }), [products, query, status, priceFilter]);

  const productsByCategory = useMemo(() => {
    const grouped = new Map(categories.map((category) => [category.id, []]));
    visibleProducts.forEach((product) => {
      if (!grouped.has(product.category_id)) grouped.set(product.category_id, []);
      grouped.get(product.category_id).push(product);
    });
    return grouped;
  }, [categories, visibleProducts]);

  const toggleFolder = (categoryId) => {
    setOpenFolders((previous) => {
      const next = new Set(previous);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  };

  const beginEdit = (product) => {
    setEditing(product);
    setFields((product.fields || []).map((field) => ({ label: field.label || '', type: field.type || 'text', required: !!field.required })));
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const beginNew = () => {
    setEditing(null);
    setFields([]);
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...raw,
      price: Number(raw.price),
      old_price: raw.old_price ? Number(raw.old_price) : null,
      is_featured: raw.is_featured === 'on',
      is_active: raw.is_active === 'on',
      fields: fields.map((field) => ({ label: field.label.trim(), type: field.type, required: field.required })).filter((field) => field.label),
    };
    try {
      if (editing) await api(`/admin/products/${editing.id}`, { method: 'PUT', body });
      else await api('/admin/products', { method: 'POST', body });
      setMessage(editing ? 'تم حفظ تغييرات المنتج.' : 'تمت إضافة المنتج داخل المجلد المحدد.');
      setEditing(null);
      setFields([]);
      await load();
    } catch (err) { setError(err.message || 'تعذر حفظ المنتج'); }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`حذف المنتج «${product.name}»؟`)) return;
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      setMessage('تم حذف المنتج.');
      await load();
    } catch (err) { setError(err.message || 'تعذر حذف المنتج'); }
  };

  const updateField = (index, patch) => setFields((previous) => previous.map((field, itemIndex) => itemIndex === index ? { ...field, ...patch } : field));

  return (
    <div className="admin-panel products-tree-page">
      <div className="admin-heading">
        <div>
          <div className="eyebrow">المنتجات / جميع المنتجات</div>
          <h1>المنتجات</h1>
          <p className="muted">تُعرض المنتجات داخل مجلدات التصنيفات. إدارة أسماء المجلدات وأيقوناتها تتم من صفحة التصنيفات فقط.</p>
        </div>
        <div className="admin-heading-actions"><button className="btn btn-outline btn-sm" onClick={load}>تحديث</button><button className="btn btn-primary btn-sm" onClick={beginNew}>إضافة منتج</button></div>
      </div>

      <div className="products-filterbar admin-surface">
        <input className="input" placeholder="ابحث داخل المنتجات فقط…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">كل الحالات</option><option value="active">منشور</option><option value="inactive">مخفي</option></select>
        <select className="input" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}><option value="all">كل الأسعار</option><option value="free">سعر تجريبي</option><option value="paid">بسعر محدد</option></select>
        <span className="muted small">{visibleProducts.length} منتج معروض</span>
      </div>

      {(editing || message || error) && (
        <section className="admin-surface product-editor-surface">
          <div className="section-head"><div><h2>{editing ? `تحرير: ${editing.name}` : 'إضافة منتج جديد'}</h2><p className="muted small">تعديل المنتج لا يغير إعدادات المجلد. يمكن فقط اختيار المجلد الذي ينتمي إليه المنتج.</p></div>{editing && <button className="btn btn-outline btn-sm" onClick={beginNew}>إغلاق المحرر</button>}</div>
          {error && <p className="error-txt">{error}</p>}
          {message && <p className="ok-txt">{message}</p>}
          <form key={editing?.id || 'new-product'} className="admin-form product-editor-form" onSubmit={save}>
            {!editing && <input className="input" name="tool_name" placeholder="اسم الأداة الموحد (اختياري)" />}
            <input className="input" name="name" placeholder="اسم الخدمة أو الباقة" defaultValue={editing?.name || ''} required />
            <input className="input" name="package_label" placeholder="وسم الباقة (اختياري)" defaultValue={editing?.package_label || ''} />
            <select className="input" name="category_id" defaultValue={editing?.category_id || categories[0]?.id} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <input className="input" name="price" type="number" min="0" step="0.01" placeholder="السعر (د.م.)" defaultValue={editing?.price ?? ''} required />
            <input className="input" name="old_price" type="number" min="0" step="0.01" placeholder="السعر السابق (د.م.، اختياري)" defaultValue={editing?.old_price ?? ''} />
            <input className="input" name="emoji" placeholder="رمز المنتج" defaultValue={editing?.emoji || '◈'} />
            <textarea className="input" name="description" rows="2" placeholder="وصف مختصر للمنتج" defaultValue={editing?.description || ''} />
            <label className="check"><input type="checkbox" name="is_featured" defaultChecked={!!editing?.is_featured} /> مميز</label>
            <label className="check"><input type="checkbox" name="is_active" defaultChecked={editing ? !!editing.is_active : true} /> منشور</label>
            <div className="fields-builder">
              <h4>حقول العميل الديناميكية</h4>
              <p className="muted small">مثال: Email أو اسم المستخدم أو رقم IMEI. تظهر هذه الحقول فقط عند طلب هذا المنتج.</p>
              {fields.map((field, index) => <div className="field-row" key={`${field.label}-${index}`}><input className="input input-sm" placeholder="تسمية الحقل" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /><select className="input input-sm" value={field.type} onChange={(event) => updateField(index, { type: event.target.value })}><option value="text">نص قصير</option><option value="textarea">نص طويل</option></select><label className="check"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /> إجباري</label><button type="button" className="btn btn-danger btn-sm" onClick={() => setFields((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>حذف</button></div>)}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setFields((previous) => [...previous, { label: '', type: 'text', required: true }])}>إضافة حقل</button>
            </div>
            <button className="btn btn-primary">{editing ? 'حفظ التعديل' : 'إضافة المنتج'}</button>
          </form>
        </section>
      )}

      {error && !editing && <p className="error-txt">{error}</p>}
      {message && !editing && <p className="ok-txt">{message}</p>}

      <div className="category-tree" aria-label="مجلدات التصنيفات">
        {categories.map((category) => {
          const items = productsByCategory.get(category.id) || [];
          const isOpen = openFolders.has(category.id);
          return <section className={`category-folder ${isOpen ? 'is-open' : ''}`} key={category.id}>
            <button className="category-folder-head" onClick={() => toggleFolder(category.id)} aria-expanded={isOpen}>
              <CategoryIcon category={category} />
              <span className="category-folder-copy"><b>{category.name}</b><small>{items.length} منتج معروض من أصل {category.product_count || 0}</small></span>
              <span className="folder-readonly">إدارة التصنيف من صفحة التصنيفات</span>
              <span className="folder-chevron" aria-hidden="true">{isOpen ? '⌄' : '‹'}</span>
            </button>
            {isOpen && <div className="folder-products">
              {!items.length && <p className="muted empty-inline">لا توجد منتجات مطابقة داخل هذا المجلد.</p>}
              {items.map((product) => <article className="folder-product-row" key={product.id}>
                <button className="folder-product-main" onClick={() => beginEdit(product)}><span className="product-symbol">{product.emoji || '◈'}</span><span><b>{product.name}</b><small>{product.package_label || product.tool_name || 'خدمة رقمية'} · آخر تعديل: {product.created_at}</small></span></button>
                <strong>{money(product.price)}</strong>
                <span className={`status-pill ${product.is_active ? 'success' : 'rejected'}`}>{product.is_active ? 'منشور' : 'مخفي'}</span>
                <div className="folder-product-actions"><button className="btn btn-outline btn-sm" onClick={() => beginEdit(product)}>فتح وتعديل</button><button className="btn btn-danger btn-sm" onClick={() => removeProduct(product)}>حذف</button></div>
              </article>)}
            </div>}
          </section>;
        })}
      </div>
    </div>
  );
}
