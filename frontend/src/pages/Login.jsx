import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth';
import { api } from '../api';
import { ErrorBox } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testAccounts, setTestAccounts] = useState(null);

  useEffect(() => {
    api
      .get('/meta')
      .then((d) => setTestAccounts(d.testAccounts))
      .catch(() => {});
  }, []);

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

        {/* {testAccounts && (
          <details className="test-box">
            <summary>Тестові акаунти для перевірки</summary>
            <div className="test-list">
              {testAccounts.list.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(testAccounts.password);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="small">Кнопка підставляє пошту й пароль у форму.</p>
          </details>
        )} */}
      </form>
    </div>
  );
}
