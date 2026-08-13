import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';

const logoPath = `${import.meta.env.BASE_URL}assets/chrigsm-logo.jpg`;

export default function Navbar() {
  const { user, cartCount, notifications, loadNotifications } = useApp();
  const navigate = useNavigate();
  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="app-brand" aria-label="الصفحة الرئيسية">
          <img src={logoPath} alt="ChriGsm" />
          <span>ChriGsm</span>
        </Link>

        <nav className="desktop-nav" aria-label="التنقل الرئيسي">
          <NavLink to="/" end>الرئيسية</NavLink>
          <NavLink to="/shop">الكتالوغ</NavLink>
          <NavLink to="/cart">السلة{cartCount ? ` (${cartCount})` : ''}</NavLink>
        </nav>

        <div className="app-header-actions">
          <button className="circle-action" type="button" aria-label="الإشعارات" onClick={() => {
            if (!user) return navigate('/login');
            loadNotifications();
            navigate('/profile?tab=notifications');
          }}>
            ♧{unread > 0 ? <span className="notification-dot" /> : null}
          </button>
          <Link className="circle-action cart-action" to="/cart" aria-label="سلة المشتريات">
            ▢{cartCount > 0 ? <span className="cart-count">{cartCount}</span> : null}
          </Link>
          {user ? (
            <button type="button" className="login-action" onClick={() => navigate('/profile')}>حسابي</button>
          ) : (
            <Link to="/login" className="login-action">تسجيل الدخول</Link>
          )}
        </div>
      </div>
    </header>
  );
}
