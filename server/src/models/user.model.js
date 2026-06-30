import { db } from '../db/index.js';

// Columns that are safe to expose to clients (never the password hash).
const PUBLIC_FIELDS =
  'id, username, nickname, role, avatar, avatar_color, timezone, must_change_password, created_at';

/** Convert a DB row into the shape the API returns (camelCase, no secrets). */
function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    role: row.role,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    timezone: row.timezone || null,
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
  };
}

export const Users = {
  // --- Reads ---------------------------------------------------------------

  /** Full row including password_hash — used only for authentication. */
  findRawByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  },

  findById(id) {
    return toPublic(db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id));
  },

  findRawById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  list() {
    const rows = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY nickname COLLATE NOCASE`).all();
    return rows.map(toPublic);
  },

  countAdmins() {
    return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  },

  // --- Writes --------------------------------------------------------------

  create({ username, nickname, passwordHash, role = 'user', mustChangePassword = true }) {
    const info = db
      .prepare(
        `INSERT INTO users (username, nickname, password_hash, role, must_change_password)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(username, nickname, passwordHash, role, mustChangePassword ? 1 : 0);
    return this.findById(info.lastInsertRowid);
  },

  /** Patch any subset of editable fields. Values left undefined are untouched. */
  update(id, { nickname, role, avatar, username, avatarColor, timezone } = {}) {
    const current = this.findRawById(id);
    if (!current) return null;
    db.prepare(
      `UPDATE users SET
         username     = ?,
         nickname     = ?,
         role         = ?,
         avatar       = ?,
         avatar_color = ?,
         timezone     = ?
       WHERE id = ?`
    ).run(
      username ?? current.username,
      nickname ?? current.nickname,
      role ?? current.role,
      avatar === undefined ? current.avatar : avatar,
      avatarColor === undefined ? current.avatar_color : avatarColor,
      timezone === undefined ? current.timezone : timezone,
      id
    );
    return this.findById(id);
  },

  setPassword(id, passwordHash, { mustChange = false } = {}) {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?').run(
      passwordHash,
      mustChange ? 1 : 0,
      id
    );
  },

  remove(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

export { toPublic };
