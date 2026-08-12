import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';

export default function Login() {
  const { login, register, user } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) { navigate('/profile'); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') await login(phone, password);
      else await register(name, phone, password);
      navigate('/profile');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container auth-wrap">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h1>
        <p className="muted">{mode === 'login' ? 'أهلاً بعودتك 👋' : 'أنشئ حسابك لتبدأ التسوق'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <input className="input" placeholder="الاسم الكامل" value={name} onChange={e => setName(e.target.value)} required />
          )}
          <input className="input" type="tel" placeholder="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} required />
          <input className="input" type="password" placeholder="كلمة المرور (6+ أحرف)" value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error-txt">{err}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? '...' : (mode === 'login' ? 'دخول' : 'إنشاء الحساب')}</button>
        </form>
        <p className="switch-mode">
          {mode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب؟ '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }} className="link-btn">
            {mode === 'login' ? 'سجّل الآن' : 'سجّل دخول'}
          </button>
        </p>
      </div>
    </div>
  );
}
