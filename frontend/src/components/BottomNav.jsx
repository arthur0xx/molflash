import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';
import { CartIcon } from './CartIcons.jsx';

const items = [
  { to: '/', label: 'الرئيسية', icon: '⌂', end: true },
  { to: '/shop', label: 'الكتالوغ', icon: '▦' },
  { to: '/cart', label: 'السلة', cart: true },
  { to: '/profile', label: 'حسابي', icon: '♙' },
];

export default function BottomNav() {
  const { user } = useApp();
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav" aria-label="تنقل التطبيق">
      {items.map((item) => {
        if (item.to === '/profile' && !user) {
          return (
            <button key={item.to} type="button" className="bottom-nav-item" onClick={() => navigate('/login')}>
              <span>{item.cart ? <CartIcon size={21} /> : item.icon}</span><small>دخول</small>
            </button>
          );
        }
        return (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span>{item.cart ? <CartIcon size={21} /> : item.icon}</span><small>{item.label}</small>
          </NavLink>
        );
      })}
    </nav>
  );
}
