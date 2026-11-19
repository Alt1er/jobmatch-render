import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth, homeFor, roleName } from '../auth';
import { Logo, Spinner } from './ui';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className="nav-links" aria-label="Головна навігація">
          <NavLink to="/vacancies">Вакансії</NavLink>
          {user?.role === 'candidate' && (
            <>
              <NavLink to="/cabinet" end>
                Мої резюме
              </NavLink>
              <NavLink to="/cabinet/applications">Мої відгуки</NavLink>
            </>
          )}
          {user?.role === 'employer' && <NavLink to="/employer">Мої вакансії</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Адмін-панель</NavLink>}
          <NavLink to="/feedback">Зворотний зв'язок</NavLink>
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user" title={user.email}>
                {user.role === 'employer' ? user.companyName || user.name : user.name}
                <small>{roleName[user.role]}</small>
              </span>
              <button className="btn btn-ghost" onClick={onLogout}>
                Вийти
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost">
                Увійти
              </NavLink>
              <NavLink to="/register" className="btn btn-primary">
                Реєстрація
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    api
      .get('/meta')
      .then((d) => setVersion(d.version))
      .catch(() => {});
  }, []);
  return (
    <footer className="footer">
      <div className="container">
        <span>JobMatch — інтелектуальне зіставлення вакансій і резюме{version && <span className="muted"> · v{version}</span>}</span>
        <span className="muted">
          Знайшли помилку чи маєте ідею? <Link to="/feedback">Напишіть нам</Link>
        </span>
      </div>
    </footer>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <Navbar />
      <main className="container main" key={pathname.split('/')[1]}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Доступ лише для авторизованих (та, за потреби, для певної ролі) */
export function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
