import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand-name">⚡ <b>chrigsm</b></div>
          <p className="muted">منصة منظمة لاستعراض أدوات GSM واختيار باقات التفعيل أو التجديد أو الرصيد من مكان واحد.</p>
        </div>
        <div>
          <h4>الكتالوج</h4>
          <Link to="/shop">كل الأدوات</Link>
          <Link to="/shop?sort=price_asc">الباقات حسب السعر</Link>
        </div>
        <div>
          <h4>الحساب</h4>
          <Link to="/login">تسجيل الدخول</Link>
          <Link to="/profile">متابعة الطلبات</Link>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} chrigsm — جميع الحقوق محفوظة</div>
    </footer>
  );
}
