import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import ProductCard, { productPrice } from '../components/ProductCard.jsx';

const iconByType = { ACTIVATION: '⌁', SERVER: '◈', RENTAL: '◷', MISC: '✦' };

export default function Tool() {
  const { toolKey } = useParams();
  const navigate = useNavigate();
  const { addToCart, user } = useApp();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [openNote, setOpenNote] = useState('description');
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    api(`/tools/${toolKey}`).then((response) => {
      setData(response);
      setSelectedId(response.packages[0]?.id || null);
    }).catch((requestError) => setError(requestError.message));
  }, [toolKey]);

  const selectedPackage = useMemo(() => data?.packages.find((item) => item.id === selectedId), [data, selectedId]);
  if (error) return <main className="app-page"><div className="app-container"><p className="empty-state">{error}</p></div></main>;
  if (!data || !selectedPackage) return <main className="app-page"><div className="app-container"><p className="empty-state">جارٍ تحميل تفاصيل الخدمة…</p></div></main>;

  const { tool, packages, related } = data;
  const proceed = () => {
    addToCart(selectedPackage, 1);
    if (!user) return navigate('/login');
    navigate('/checkout');
  };

  const infoRows = [
    { id: 'description', title: 'وصف الخدمة', body: tool.description || 'خدمة رقمية منظمة ضمن كتالوج ChriGsm.' },
    { id: 'requirements', title: 'ما ستحتاجه قبل الطلب', body: selectedPackage.fields?.length ? `سيُطلب منك إدخال: ${selectedPackage.fields.map((field) => field.label).join('، ')}.` : 'راجع تفاصيل الباقة واختر الخيار الأنسب قبل المتابعة.' },
    { id: 'delivery', title: 'طريقة المتابعة', body: selectedPackage.delivery_time || 'تظهر تفاصيل المتابعة في حسابك بعد إنشاء الطلب.' },
    { id: 'notes', title: 'ملاحظات مهمة', body: 'تحقق من بياناتك قبل تأكيد الطلب. الأسعار الحالية تجريبية ويمكن تعديلها من لوحة الإدارة.' },
  ];

  return (
    <main className="app-page detail-page">
      <div className="app-container">
        <button className="back-link" type="button" onClick={() => navigate(-1)}>→ رجوع</button>
        <section className="detail-card">
          <span className="detail-icon">{iconByType[tool.service_type] || '◌'}</span>
          <div className="detail-heading"><span>{tool.category_name}</span><h1>{tool.tool_name}</h1><em className="availability"><i /> متوفر</em></div>
          <strong className="detail-price">{productPrice(selectedPackage.price)}</strong>
        </section>

        <section className="package-section">
          <div className="section-title-row"><h2>اختر الباقة</h2><span>{packages.length} خيارات</span></div>
          <div className="package-tabs">
            {packages.map((item) => <button key={item.id} type="button" className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.package_label || item.name}</button>)}
          </div>
        </section>

        <section className="detail-notes">
          {infoRows.map((item) => (
            <article key={item.id} className={`note-row ${openNote === item.id ? 'open' : ''}`}>
              <button type="button" onClick={() => setOpenNote(openNote === item.id ? '' : item.id)}><b>{item.title}</b><span>{openNote === item.id ? '−' : '+'}</span></button>
              {openNote === item.id ? <p>{item.body}</p> : null}
            </article>
          ))}
        </section>

        {related.length ? <section className="app-section related-section"><div className="section-title-row"><h2>خدمات مشابهة</h2></div><div className="horizontal-products">{related.map((item) => <ProductCard key={item.tool_key} product={item} />)}</div></section> : null}
      </div>

      <div className="sticky-order-bar">
        <div><small>الإجمالي</small><b>{productPrice(selectedPackage.price)}</b></div>
        <button type="button" onClick={proceed}>متابعة الطلب ←</button>
      </div>
    </main>
  );
}
