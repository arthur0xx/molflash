import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';

export default function Navbar() {
  const { user, cartCount, logout, notifications, loadNotifications } = useApp();
  const navigate = useNavigate();

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="brand-logo">⚡</span>
          <span className="brand-name">أكواد <b>تيك</b></span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>الرئيسية</NavLink>
          <NavLink to="/shop">المتجر</NavLink>
        </nav>
        <div className="nav-actions">
          <Link to="/cart" className="nav-icon-btn" title="السلة">
            🛒 {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>
          {user ? (
            <>
              <button className="nav-icon-btn" title="الإشعارات" onClick={() => { loadNotifications(); navigate('/profile?tab=notifications'); }}>
                🔔 {unread > 0 && <span className="badge">{unread}</span>}
              </button>
              <button className="nav-icon-btn" title="حسابي" onClick={() => navigate('/profile')}>👤</button>
              <span className="balance-chip" title="رصيد المحفظة">💳 {user.balance} درهم</span>
              {user.role === 'admin' && <Link to="/admin" className="nav-icon-btn" title="لوحة التحكم">⚙️</Link>}
              <button className="nav-icon-btn" title="تسجيل الخروج" onClick={() => { logout(); navigate('/'); }}>🚪</button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">دخول / تسجيل</Link>
          )}
        </div>
      </div>
    </header>
  );
}
