import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const blankCategory = { name: '', emoji: '📁', icon_url: '', description: '', sort_order: 0 };

function CategoryIcon({ category }) {
  if (category.icon_url) return <img className="category-management-icon-image" src={category.icon_url} alt="" />;
  return <span className="category-management-icon-emoji" aria-hidden="true">{category.emoji || '📁'}</span>;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [iconUrl, setIconUrl] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setCategories(await api('/admin/categories')); }
    catch (err) { setError(err.message || 'تعذر تحميل التصنيفات'); }
  };

  useEffect(() => { load(); }, []);

  const openEditor = (category = null) => {
    setEditing(category || blankCategory);
    setIconUrl(category?.icon_url || '');
    setMessage('');
    setError('');
  };

  const closeEditor = () => { setEditing(null); setIconUrl(''); };

  const readIconFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('يرجى اختيار ملف صورة صالح للأيقونة.'); return; }
    if (file.size > 350 * 1024) { setError('يجب أن يكون حجم أيقونة التصنيف أقل من 350 كيلوبايت.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setIconUrl(String(reader.result || '')); setError(''); };
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      name: String(raw.name || '').trim(),
      emoji: String(raw.emoji || '📁').trim() || '📁',
      icon_url: iconUrl.trim(),
      description: String(raw.description || '').trim(),
      sort_order: Number(raw.sort_order) || 0,
    };
    if (!body.name) { setError('اسم التصنيف مطلوب.'); return; }
    setSaving(true); setError('');
    try {
      if (editing?.id) await api(`/admin/categories/${editing.id}`, { method: 'PUT', body });
      else await api('/admin/categories', { method: 'POST', body });
      setMessage(editing?.id ? 'تم تحديث التصنيف.' : 'تمت إضافة التصنيف.');
      closeEditor();
      await load();
    } catch (err) { setError(err.message || 'تعذر حفظ التصنيف'); }
    finally { setSaving(false); }
  };

  const deleteCategory = async () => {
    if (!confirmingDelete || confirmationName.trim() !== confirmingDelete.name) return;
    setSaving(true); setError('');
    try {
      const result = await api(`/admin/categories/${confirmingDelete.id}`, { method: 'DELETE', body: { confirmationName: confirmingDelete.name } });
      setMessage(`تم حذف التصنيف و${result.deletedProducts || 0} منتج تابع له نهائيًا.`);
      setConfirmingDelete(null);
      setConfirmationName('');
      await load();
    } catch (err) { setError(err.message || 'تعذر حذف التصنيف'); }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-panel category-management-page">
      <div className="admin-heading">
        <div><div className="eyebrow">إدارة مجلدات الكتالوج</div><h1>التصنيفات</h1><p className="muted">هنا فقط يمكن تعديل اسم التصنيف وأيقونته وترتيبه. تظهر هذه التصنيفات كمجلدات للقراءة في صفحة المنتجات.</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => openEditor()}>إضافة تصنيف</button>
      </div>
      {message && <p className="ok-txt">{message}</p>}
      {error && <p className="error-txt">{error}</p>}

      <div className="category-management-list">
        {categories.map((category) => <article className="category-management-card" key={category.id}>
          <CategoryIcon category={category} />
          <div className="category-management-copy"><b>{category.name}</b><span>{category.description || 'بدون وصف'}</span><small>{category.product_count || 0} منتج · ترتيب {category.sort_order}</small></div>
          <div className="category-management-actions"><button className="btn btn-outline btn-sm" onClick={() => openEditor(category)}>تعديل</button><button className="btn btn-danger btn-sm" onClick={() => { setConfirmingDelete(category); setConfirmationName(''); setError(''); }}>حذف</button></div>
        </article>)}
        {!categories.length && <div className="empty"><p>لا توجد تصنيفات بعد. أضف أول مجلد للمنتجات.</p></div>}
      </div>

      {editing && <div className="admin-modal-backdrop" role="presentation"><section className="admin-modal category-editor-modal" role="dialog" aria-modal="true" aria-label="تحرير تصنيف">
        <div className="section-head"><div><h2>{editing.id ? `تحرير ${editing.name}` : 'إضافة تصنيف'}</h2><p className="muted small">اختر أيقونة برفع ملف صغير أو بإضافة رابط مباشر.</p></div><button className="modal-close" onClick={closeEditor} aria-label="إغلاق">×</button></div>
        <form key={editing.id || 'new-category'} className="category-editor-form" onSubmit={save}>
          <label className="field-label">اسم التصنيف</label><input className="input" name="name" defaultValue={editing.name} placeholder="مثال: خدمات السيرفر" required />
          <label className="field-label">الرمز البديل</label><input className="input" name="emoji" defaultValue={editing.emoji || '📁'} placeholder="📁" />
          <label className="field-label">وصف مختصر</label><textarea className="input" name="description" rows="3" defaultValue={editing.description || ''} placeholder="شرح مختصر لما يحتويه المجلد" />
          <label className="field-label">ترتيب الظهور</label><input className="input" name="sort_order" type="number" defaultValue={editing.sort_order || 0} />
          <div className="icon-source-box"><div><b>أيقونة فريدة للتصنيف</b><p className="muted small">يمكن رفع PNG أو JPG أو WEBP بحجم أقل من 350 كيلوبايت، أو استخدام رابط https.</p></div><div className="icon-source-actions"><label className="btn btn-outline btn-sm file-button">رفع أيقونة<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => readIconFile(event.target.files?.[0])} /></label><input className="input" dir="ltr" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://… أو ارفع ملفًا" /></div>{iconUrl && <div className="icon-preview"><img src={iconUrl} alt="معاينة الأيقونة" /><button type="button" className="btn btn-outline btn-sm" onClick={() => setIconUrl('')}>إزالة الأيقونة</button></div>}</div>
          <div className="admin-modal-actions"><button type="button" className="btn btn-outline" onClick={closeEditor}>إلغاء</button><button className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ التصنيف'}</button></div>
        </form>
      </section></div>}

      {confirmingDelete && <div className="admin-modal-backdrop" role="presentation"><section className="admin-modal delete-category-modal" role="dialog" aria-modal="true" aria-label="تأكيد حذف التصنيف">
        <div className="delete-warning-mark" aria-hidden="true">!</div><h2>حذف التصنيف «{confirmingDelete.name}»؟</h2><p>سيؤدي هذا الإجراء إلى حذف <b>{confirmingDelete.product_count || 0} منتج</b> داخل هذا التصنيف نهائيًا. لا يمكن التراجع عن هذا الحذف.</p>
        <label className="field-label">للتأكيد، اكتب اسم التصنيف تمامًا: <b>{confirmingDelete.name}</b></label><input className="input" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={confirmingDelete.name} autoFocus />
        <div className="admin-modal-actions"><button className="btn btn-outline" onClick={() => { setConfirmingDelete(null); setConfirmationName(''); }}>إلغاء</button><button className="btn btn-danger" disabled={saving || confirmationName.trim() !== confirmingDelete.name} onClick={deleteCategory}>{saving ? 'جارٍ الحذف…' : 'حذف نهائي'}</button></div>
      </section></div>}
    </div>
  );
}
