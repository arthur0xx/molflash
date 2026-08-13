import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Tool() {
  const { toolKey } = useParams();
  const navigate = useNavigate();
  const { addToCart, user } = useApp();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api(`/tools/${toolKey}`).then((response) => {
      setData(response);
      setSelectedId(response.packages[0]?.id || null);
    }).catch((requestError) => setError(requestError.message));
  }, [toolKey]);

  const selectedPackage = useMemo(() => data?.packages.find((item) => item.id === selectedId), [data, selectedId]);
  if (error) return <div className="container"><p className="error-txt">{error}</p></div>;
  if (!data || !selectedPackage) return <div className="container"><p className="muted">جارٍ تحميل الأداة…</p></div>;

  const orderNow = () => {
    if (!user) return navigate('/login');
    addToCart(selectedPackage, 1);
    navigate('/checkout');
  };

  const { tool, packages, related } = data;
  return (
    <div className="container tool-page">
      <div className="tool-detail">
        <div className="tool-hero-image" style={{ background: tool.gradient }}>
          <img src={tool.asset_path || '/assets/chrigsm-default-service-hero.png'} alt={`هوية ${tool.tool_name}`} />
          <img className="tool-brand-stamp tool-brand-stamp-detail" src="/assets/chrigsm-mark.png" alt="chrigsm" />
          <span className="tool-image-badge">{tool.asset_status === 'ready' ? 'صورة الأداة' : 'صورة افتراضية'}</span>
        </div>
        <div className="tool-info">
          <Link to={`/shop?category=${tool.category_id}`} className="cat-name">{tool.category_name}</Link>
          <h1>{tool.tool_name}</h1>
          <p className="pd-desc">اختر باقتك المناسبة لهذه الأداة. جميع الخيارات أدناه تستخدم الهوية البصرية نفسها ولا تختلف إلا في المدة أو نوع الخدمة والسعر.</p>
          <div className="tool-meta">
            <span>{tool.package_count} باقات</span>
            <span>{tool.service_type || 'خدمة GSM'}</span>
            <span>بدءاً من {tool.price} USD</span>
          </div>

          <div className="package-picker">
            <div className="package-picker-head"><h3>اختر الباقة</h3><span>{packages.length} خيارات</span></div>
            <div className="package-list">
              {packages.map((item) => (
                <button key={item.id} type="button" className={`package-option ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
                  <span className="package-radio" aria-hidden="true" />
                  <span className="package-copy"><b>{item.package_label || item.name}</b><small>{item.delivery_time || 'حسب تفاصيل الخدمة'}</small></span>
                  <strong>{item.price} USD</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="selected-package-note">
            <b>الباقة المختارة: {selectedPackage.package_label || selectedPackage.name}</b>
            <span>{selectedPackage.fields?.length ? `سيُطلب منك إدخال ${selectedPackage.fields.length} حقول عند إتمام الطلب.` : 'لا توجد حقول إضافية لهذه الباقة.'}</span>
          </div>
          <div className="pd-actions">
            <button className="btn btn-primary btn-lg" onClick={orderNow}>اختيار ومتابعة الطلب</button>
            <button className="btn btn-outline btn-lg" onClick={() => addToCart(selectedPackage, 1)}>أضف الباقة للسلة</button>
          </div>
          {!user ? <p className="muted">يلزم تسجيل الدخول قبل تأكيد الطلب — <Link to="/login">دخول</Link></p> : null}
        </div>
      </div>

      {related.length ? (
        <section className="home-section">
          <div className="section-head"><h2>أدوات مشابهة</h2></div>
          <div className="h-scroll">{related.map((item) => <ProductCard key={item.tool_key} product={item} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
