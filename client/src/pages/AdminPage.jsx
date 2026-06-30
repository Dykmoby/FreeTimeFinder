import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import CalendarEditor from '../components/CalendarEditor.jsx';
import { makeEditorPlumbing } from '../lib/availabilityClient.js';
import { getLocalTimeZone } from '../lib/tz.js';

export default function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const { users } = await api('/admin/users');
      setUsers(users);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function flashNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  }

  async function handleCreate(payload) {
    setError('');
    try {
      await api('/admin/users', { method: 'POST', body: payload });
      flashNotice(`Пользователь «${payload.username}» создан. Временный пароль: ${payload.password}`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(id, patch) {
    setError('');
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: patch });
      setEditingId(null);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReset(id) {
    const password = prompt('Новый временный пароль (минимум 4 символа):');
    if (!password) return;
    try {
      await api(`/admin/users/${id}/password`, { method: 'POST', body: { password } });
      flashNotice('Пароль сброшен. Пользователь сменит его при следующем входе.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id, nickname) {
    if (!confirm(`Удалить пользователя «${nickname}»? Его отметки тоже удалятся.`)) return;
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      if (manageId === id) setManageId(null);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h1 className="page__title">Админ-панель</h1>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="toast toast--ok toast--inline">{notice}</div>}

      <CreateUserForm onCreate={handleCreate} />

      <div className="card">
        <div className="card__title">Пользователи ({users.length})</div>
        <div className="user-table">
          {users.map((u) => (
            <div key={u.id} className="user-row-wrap">
              <div className="user-row">
                <div className="user-row__main">
                  <Avatar user={u} size={38} />
                  <div>
                    <div className="user-row__nick">
                      {u.nickname}
                      {u.role === 'admin' && <span className="badge">админ</span>}
                      {u.id === me.id && <span className="badge badge--muted">вы</span>}
                    </div>
                    <div className="muted">@{u.username}</div>
                  </div>
                </div>
                <div className="user-row__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => setManageId(manageId === u.id ? null : u.id)}>
                    Время
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                    Изменить
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => handleReset(u.id)}>
                    Пароль
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => handleDelete(u.id, u.nickname)}
                    disabled={u.id === me.id}
                    title={u.id === me.id ? 'Нельзя удалить себя' : ''}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              {editingId === u.id && (
                <EditUserForm user={u} onSave={(patch) => handleUpdate(u.id, patch)} onCancel={() => setEditingId(null)} />
              )}

              {manageId === u.id && <AvailabilityEditor user={u} users={users} onError={setError} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Create ------------------------------------------------------------------

function CreateUserForm({ onCreate }) {
  const [form, setForm] = useState({ username: '', nickname: '', password: '', role: 'user' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    onCreate({
      username: form.username.trim(),
      nickname: form.nickname.trim() || form.username.trim(),
      password: form.password,
      role: form.role,
    });
    setForm({ username: '', nickname: '', password: '', role: 'user' });
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card__title">Создать пользователя</div>
      <div className="form-grid">
        <label className="field">
          <span>Логин</span>
          <input value={form.username} onChange={set('username')} placeholder="ivan" required />
        </label>
        <label className="field">
          <span>Ник</span>
          <input value={form.nickname} onChange={set('nickname')} placeholder="Иван" />
        </label>
        <label className="field">
          <span>Временный пароль</span>
          <input value={form.password} onChange={set('password')} placeholder="мин. 4 символа" required />
        </label>
        <label className="field">
          <span>Роль</span>
          <select value={form.role} onChange={set('role')}>
            <option value="user">Пользователь</option>
            <option value="admin">Админ</option>
          </select>
        </label>
      </div>
      <button className="btn btn--primary">Создать</button>
    </form>
  );
}

// --- Edit --------------------------------------------------------------------

function EditUserForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({ username: user.username, nickname: user.nickname, role: user.role });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form className="edit-panel" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Логин</span>
          <input value={form.username} onChange={set('username')} />
        </label>
        <label className="field">
          <span>Ник</span>
          <input value={form.nickname} onChange={set('nickname')} />
        </label>
        <label className="field">
          <span>Роль</span>
          <select value={form.role} onChange={set('role')}>
            <option value="user">Пользователь</option>
            <option value="admin">Админ</option>
          </select>
        </label>
      </div>
      <div className="row-gap">
        <button className="btn btn--primary btn--sm">Сохранить</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

// --- Availability editor (admin edits a user's free time) --------------------
// Same editing surface as the user's own calendar (paint, edge-resize, precise
// entry, per-row editing, per-interval visibility, month/week/day) — only the
// endpoints differ. An interval here can be limited to anyone *except* its owner.

function AvailabilityEditor({ user, users, onError }) {
  const people = useMemo(() => users.filter((u) => u.id !== user.id), [users, user.id]);

  // Edit the user's calendar in *their* timezone, so what the admin paints lands
  // on the user's own clock. Falls back to the admin's zone if the user has none
  // recorded yet (they haven't logged in since timezone support landed).
  const tz = user.timezone || getLocalTimeZone();
  const { fetchRange, replaceDay, removeInterval } = useMemo(
    () => makeEditorPlumbing({
      tz,
      listPath: `/admin/users/${user.id}/availability`,
      dayPath: `/admin/users/${user.id}/availability/day`,
      delPath: (id) => `/admin/availability/${id}`,
    }),
    [user.id, tz],
  );

  return (
    <div className="edit-panel">
      <CalendarEditor
        compact
        heading={(
          <div className="cal-head__user">
            <Avatar user={user} size={26} /> Время · {user.nickname}
          </div>
        )}
        people={people}
        fetchRange={fetchRange}
        replaceDay={replaceDay}
        removeInterval={removeInterval}
        onError={onError}
      />
    </div>
  );
}
