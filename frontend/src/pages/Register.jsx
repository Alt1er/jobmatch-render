import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../auth';
import { ErrorBox } from '../components/ui';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'employer' ? 'employer' : 'candidate');
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', industry: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { ...form, role };
      if (role === 'candidate') {
        delete payload.companyName;
        delete payload.industry;
      }
      const u = await register(payload);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Реєстрація</h1>
        <div className="role-switch" role="radiogroup" aria-label="Тип акаунта">
          <button type="button" role="radio" aria-checked={role === 'candidate'} className={role === 'candidate' ? 'active' : ''} onClick={() => setRole('candidate')}>
            Я кандидат
          </button>
          <button type="button" role="radio" aria-checked={role === 'employer'} className={role === 'employer' ? 'active' : ''} onClick={() => setRole('employer')}>
            Я роботодавець
          </button>
        </div>
        <ErrorBox>{error}</ErrorBox>

        <label className="field">
          <span>{role === 'employer' ? 'Контактна особа' : "Ім'я та прізвище"}</span>
          <input value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} />
        </label>
        {role === 'employer' && (
          <>
            <label className="field">
              <span>Назва компанії</span>
              <input value={form.companyName} onChange={set('companyName')} required minLength={2} />
            </label>
            <label className="field">
              <span>Сфера діяльності (необовʼязково)</span>
              <input value={form.industry} onChange={set('industry')} />
            </label>
          </>
        )}
        <label className="field">
          <span>Електронна пошта</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Пароль (мінімум 8 символів)</span>
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required minLength={8} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Створюємо акаунт…' : 'Створити акаунт'}
        </button>
        <p className="muted center">
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </form>
    </div>
  );
}
