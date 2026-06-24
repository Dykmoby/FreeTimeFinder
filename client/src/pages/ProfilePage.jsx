import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { AVATAR_GRADIENTS, cssGradient } from '../lib/avatarGradients.js';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [nickname, setNickname] = useState(user.nickname);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function flash(setter, msg) {
    setter(msg);
    setTimeout(() => setter(''), 2500);
  }

  async function saveNickname(e) {
    e.preventDefault();
    setError('');
    try {
      const { user: updated } = await api('/profile', { method: 'PATCH', body: { nickname } });
      updateUser(updated);
      flash(setStatus, 'Ник сохранён');
    } catch (err) {
      flash(setError, err.message);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('avatar', file);
    try {
      const { user: updated } = await api('/profile/avatar', { method: 'POST', body: form });
      updateUser(updated);
      flash(setStatus, 'Аватар обновлён');
    } catch (err) {
      flash(setError, err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    try {
      const { user: updated } = await api('/profile/avatar', { method: 'DELETE' });
      updateUser(updated);
    } catch (err) {
      flash(setError, err.message);
    }
  }

  async function pickColor(avatarColor) {
    try {
      const { user: updated } = await api('/profile', { method: 'PATCH', body: { avatarColor } });
      updateUser(updated);
    } catch (err) {
      flash(setError, err.message);
    }
  }

  return (
    <div className="stack stack--narrow">
      <h1 className="page__title">Профиль</h1>

      <section className="card profile-head">
        <Avatar user={user} size={88} />
        <div className="profile-head__info">
          <div className="profile-head__nick">{user.nickname}</div>
          <div className="muted">@{user.username} · {user.role === 'admin' ? 'админ' : 'пользователь'}</div>
          <div className="profile-head__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              Загрузить аватар
            </button>
            {user.avatar && (
              <button className="btn btn--ghost btn--sm" onClick={removeAvatar}>
                Удалить
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={uploadAvatar}
            />
          </div>
        </div>
      </section>

      <form className="card" onSubmit={saveNickname}>
        <label className="field">
          <span>Ник</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
        </label>
        <button className="btn btn--primary">Сохранить</button>
      </form>

      {!user.avatar && (
        <section className="card">
          <div className="card__title">Цвет аватара</div>
          <p className="muted" style={{ marginTop: 0 }}>Пока вы не загрузили картинку, аватар рисуется буквами на градиенте.</p>
          <div className="swatches">
            <button
              type="button"
              className={`swatch swatch--auto ${!user.avatarColor ? 'is-active' : ''}`}
              onClick={() => pickColor(null)}
              title="Авто (по нику)"
            >
              Авто
            </button>
            {AVATAR_GRADIENTS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`swatch ${user.avatarColor === g.id ? 'is-active' : ''}`}
                style={{ backgroundImage: cssGradient(g) }}
                onClick={() => pickColor(g.id)}
                aria-label={`Градиент ${g.id}`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="row-between">
          <div>
            <div className="card__title">Пароль</div>
            <div className="muted">Сменить пароль для входа</div>
          </div>
          <Link to="/change-password" className="btn btn--ghost btn--sm">
            Сменить
          </Link>
        </div>
      </section>

      {status && <div className="toast toast--ok">{status}</div>}
      {error && <div className="toast toast--err">{error}</div>}
    </div>
  );
}
