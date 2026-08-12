import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const CART_KEY = 'store_cart';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!getToken()) return setLoading(false);
    api('/auth/me').then(({ user }) => setUser(user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const login = useCallback(async (phone, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { phone, password } });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (name, phone, password) => {
    const d = await api('/auth/register', { method: 'POST', body: { name, phone, password } });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try { const { user } = await api('/auth/me'); setUser(user); } catch {}
  }, []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = useCallback((product, quantity = 1) => {
    setCart(prev => {
      const found = prev.find(i => i.product_id === product.id);
      if (found) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { product_id: product.id, name: product.name, price: product.price, emoji: product.emoji, gradient: product.gradient, fields: product.fields || [], quantity }];
    });
  }, []);

  const updateQty = useCallback((productId, qty) => {
    setCart(prev => qty <= 0
      ? prev.filter(i => i.product_id !== productId)
      : prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const loadNotifications = useCallback(async () => {
    if (!getToken()) return;
    try { setNotifications(await api('/notifications')); } catch {}
  }, []);

  const value = {
    user, loading, login, register, logout, refreshUser,
    cart, addToCart, updateQty, clearCart, cartCount,
    notifications, loadNotifications,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
