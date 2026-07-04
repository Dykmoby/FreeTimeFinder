import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Avatar from './Avatar.jsx';

const links = [
  { to: '/', label: 'Моё время', end: true },
  { to: '/everyone', label: 'Все' },
];

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const headerRef = useRef(null);

  // Publish the topbar's real height so the calendar can pin its day-of-week
  // header just below it on scroll. The bar is taller on mobile (two rows),
  // so measure it rather than hard-coding.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setH = () =>
      document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="topbar" ref={headerRef}>
        <div className="topbar__inner">
          <NavLink to="/" className="brand">
            <span className="brand__dot" />
            <span className="brand__name">FreeTime</span>
          </NavLink>

          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className="nav__link">
                Админ
              </NavLink>
            )}
          </nav>

          <div className="topbar__user">
            <NavLink to="/profile" className="topbar__profile" title="Профиль">
              <Avatar user={user} size={34} />
              <span className="topbar__nick">{user?.nickname}</span>
            </NavLink>
            <button className="btn btn--ghost btn--sm" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="page">{children}</main>
    </div>
  );
}
