import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, hasToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(hasToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!hasToken()) return undefined;
    let alive = true;
    api
      .get('/auth/me')
      .then((d) => alive && setUser(d.user))
      .catch(() => alive && logout())
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [logout]);

  useEffect(() => {
    window.addEventListener('jm:unauthorized', logout);
    return () => window.removeEventListener('jm:unauthorized', logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (user) =>
  user?.role === 'employer' ? '/employer' : user?.role === 'admin' ? '/admin' : '/cabinet';

export const roleName = { candidate: 'Кандидат', employer: 'Роботодавець', admin: 'Адміністратор' };
