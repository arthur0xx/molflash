import { api, setToken } from '../../api.js';

export async function login(phone, password) {
  const d = await api('/auth/login', { method: 'POST', body: { phone, password } });
  if (d.user.role !== 'admin') throw new Error('هذا الحساب ليس مديراً');
  setToken(d.token);
  return d.user;
}
