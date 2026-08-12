import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand-name">⚡ <b>chrigsm</b></div>
          <p className="muted">متجرك الموثوق لأدوات التفعيل والتعبئة - تسليم فوري ودعم عبر واتساب.</p>
        </div>
        <div>
          <h4>روابط</h4>
          <Link to="/shop">المتجر</Link>
          <Link to="/login">حسابي</Link>
        </div>
        <div>
          <h4>المساعدة</h4>
          <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">الدعم عبر واتساب</a>
          <span className="muted">رد خلال دقائق ⏱️</span>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} chrigsm - جميع الحقوق محفوظة</div>
    </footer>
  );
}
