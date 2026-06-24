import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ChangePasswordPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const forced = user?.mustChangePassword;

  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) return setError('Пароли не совпадают');
    setBusy(true);
    try {
      const { user: updated } = await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      updateUser(updated);
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
          <h1 className="shine-text">Смена пароля</h1>
          <p className="muted">
            {forced
              ? 'Это временный пароль. Задайте свой, чтобы продолжить.'
              : 'Задайте новый пароль для аккаунта.'}
          </p>
        </div>

        <label className="field">
          <span>Текущий пароль</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>Новый пароль</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Повторите новый пароль</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && <div className="alert">{error}</div>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        {forced && (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => { logout(); navigate('/login'); }}>
            Выйти
          </button>
        )}
      </form>
    </div>
  );
}
