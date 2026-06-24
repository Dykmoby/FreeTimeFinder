import { db } from '../db/index.js';

/** Parse the stored visibility JSON into an array of ids, or null for "everyone". */
function parseVisibleTo(raw) {
  if (raw == null) return null;
  try {
    const ids = JSON.parse(raw);
    if (Array.isArray(ids) && ids.length) return ids.map(Number).filter(Number.isInteger);
  } catch {
    /* fall through to "everyone" */
  }
  return null;
}

/** Serialise a visibility list for storage. Empty / null / "everyone" -> NULL. */
function serializeVisibleTo(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = [...new Set(value.map(Number).filter(Number.isInteger))];
  return ids.length ? JSON.stringify(ids) : null;
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    day: row.day,
    startMin: row.start_min,
    endMin: row.end_min,
    note: row.note,
    visibleTo: parseVisibleTo(row.visible_to),
  };
}

export { serializeVisibleTo };

export const Availability = {
  findById(id) {
    return toPublic(db.prepare('SELECT * FROM availability WHERE id = ?').get(id));
  },

  /** All intervals for one user, optionally limited to a [from, to] day range (inclusive). */
  listByUser(userId, { from, to } = {}) {
    let sql = 'SELECT * FROM availability WHERE user_id = ?';
    const args = [userId];
    if (from) {
      sql += ' AND day >= ?';
      args.push(from);
    }
    if (to) {
      sql += ' AND day <= ?';
      args.push(to);
    }
    sql += ' ORDER BY day, start_min';
    return db.prepare(sql).all(...args).map(toPublic);
  },

  /** Everyone's intervals in a day range — used by the shared/overview page. */
  listAll({ from, to } = {}) {
    let sql = 'SELECT * FROM availability';
    const args = [];
    const where = [];
    if (from) {
      where.push('day >= ?');
      args.push(from);
    }
    if (to) {
      where.push('day <= ?');
      args.push(to);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY day, start_min';
    return db.prepare(sql).all(...args).map(toPublic);
  },

  create({ userId, day, startMin, endMin, note = null, visibleTo = null }) {
    const info = db
      .prepare(
        `INSERT INTO availability (user_id, day, start_min, end_min, note, visible_to)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, day, startMin, endMin, note, serializeVisibleTo(visibleTo));
    return this.findById(info.lastInsertRowid);
  },

  update(id, { day, startMin, endMin, note, visibleTo }) {
    const current = db.prepare('SELECT * FROM availability WHERE id = ?').get(id);
    if (!current) return null;
    db.prepare(
      `UPDATE availability SET day = ?, start_min = ?, end_min = ?, note = ?, visible_to = ? WHERE id = ?`
    ).run(
      day ?? current.day,
      startMin ?? current.start_min,
      endMin ?? current.end_min,
      note === undefined ? current.note : note,
      visibleTo === undefined ? current.visible_to : serializeVisibleTo(visibleTo),
      id
    );
    return this.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM availability WHERE id = ?').run(id);
  },

  /** Replace all intervals for a user on a given day (used by the slot-grid editor). */
  replaceDay(userId, day, intervals) {
    const del = db.prepare('DELETE FROM availability WHERE user_id = ? AND day = ?');
    const ins = db.prepare(
      'INSERT INTO availability (user_id, day, start_min, end_min, note, visible_to) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      del.run(userId, day);
      for (const iv of intervals) {
        ins.run(userId, day, iv.startMin, iv.endMin, iv.note ?? null, serializeVisibleTo(iv.visibleTo));
      }
    });
    tx();
    return this.listByUser(userId, { from: day, to: day });
  },
};
