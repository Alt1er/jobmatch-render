import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth';
import { ErrorBox } from '../components/ui';

const DEMO = [
  { label: 'Кандидат', email: 'candidate@demo.ua' },
  { label: 'Роботодавець (TechNova)', email: 'hr@technova.demo' },
  { label: 'Роботодавець (DataBridge)', email: 'hr@databridge.demo' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(location.state?.from || homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Вхід</h1>
        <p className="muted">Увійдіть, щоб побачити підібрані вакансії або кандидатів.</p>
        <ErrorBox>{error}</ErrorBox>

        <label className="field">
          <span>Електронна пошта</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Входимо…' : 'Увійти'}
        </button>
        <p className="muted center">
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>

        <details className="demo-box">
          <summary>Демо-акаунти (пароль: Demo1234!)</summary>
          <div className="demo-list">
            {DEMO.map((d) => (
              <button
                type="button"
                key={d.email}
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setEmail(d.email);
                  setPassword('Demo1234!');
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </details>
      </form>
    </div>
  );
}
