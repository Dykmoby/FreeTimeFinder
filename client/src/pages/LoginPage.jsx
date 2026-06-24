import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen auth-bg">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__head">
          <span className="brand__dot brand__dot--lg" />
          <h1 className="shine-text">Free Time Finder</h1>
          <p className="muted">Войдите, чтобы отметить своё свободное время</p>
        </div>

        <label className="field">
          <span>Логин</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ваш логин"
            autoComplete="username"
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="alert">{error}</div>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
