import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from '../api.js';
import { getLocalTimeZone } from '../lib/tz.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, try to restore the session from a stored token.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // Keep the user's stored timezone in sync with the browser's, automatically —
  // so their marks are saved in the right zone with zero configuration. Runs
  // once the user is known and again only if the detected zone actually differs.
  useEffect(() => {
    if (!user) return;
    const tz = getLocalTimeZone();
    if (user.timezone === tz) return;
    api('/profile', { method: 'PATCH', body: { timezone: tz } })
      .then((data) => setUser(data.user))
      .catch(() => {}); // best-effort; a failed sync just retries next load
  }, [user]);

  const login = useCallback(async (username, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Used by Profile / change-password screens to reflect updated fields.
  const updateUser = useCallback((next) => setUser(next), []);

  const value = { user, loading, login, logout, updateUser, isAdmin: user?.role === 'admin' };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
