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
    startUtc: row.start_utc,
    endUtc: row.end_utc,
    note: row.note,
    visibleTo: parseVisibleTo(row.visible_to),
  };
}

export { serializeVisibleTo };

export const Availability = {
  findById(id) {
    return toPublic(db.prepare('SELECT * FROM availability WHERE id = ?').get(id));
  },

  /**
   * All intervals for one user, optionally limited to a UTC instant window
   * [fromUtc, toUtc) — anything overlapping the window is returned, so blocks
   * that straddle a local-day edge in some viewer's zone are still included.
   */
  listByUser(userId, { fromUtc, toUtc } = {}) {
    let sql = 'SELECT * FROM availability WHERE user_id = ?';
    const args = [userId];
    if (fromUtc != null) {
      sql += ' AND end_utc > ?';
      args.push(fromUtc);
    }
    if (toUtc != null) {
      sql += ' AND start_utc < ?';
      args.push(toUtc);
    }
    sql += ' ORDER BY start_utc';
    return db.prepare(sql).all(...args).map(toPublic);
  },

  /** Everyone's intervals overlapping a UTC window — used by the shared/overview page. */
  listAll({ fromUtc, toUtc } = {}) {
    let sql = 'SELECT * FROM availability';
    const args = [];
    const where = [];
    if (fromUtc != null) {
      where.push('end_utc > ?');
      args.push(fromUtc);
    }
    if (toUtc != null) {
      where.push('start_utc < ?');
      args.push(toUtc);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY start_utc';
    return db.prepare(sql).all(...args).map(toPublic);
  },

  create({ userId, day, startMin, endMin, startUtc, endUtc, note = null, visibleTo = null }) {
    const info = db
      .prepare(
        `INSERT INTO availability (user_id, day, start_min, end_min, start_utc, end_utc, note, visible_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(userId, day, startMin, endMin, startUtc, endUtc, note, serializeVisibleTo(visibleTo));
    return this.findById(info.lastInsertRowid);
  },

  update(id, { day, startMin, endMin, startUtc, endUtc, note, visibleTo }) {
    const current = db.prepare('SELECT * FROM availability WHERE id = ?').get(id);
    if (!current) return null;
    db.prepare(
      `UPDATE availability
         SET day = ?, start_min = ?, end_min = ?, start_utc = ?, end_utc = ?, note = ?, visible_to = ?
       WHERE id = ?`
    ).run(
      day ?? current.day,
      startMin ?? current.start_min,
      endMin ?? current.end_min,
      startUtc ?? current.start_utc,
      endUtc ?? current.end_utc,
      note === undefined ? current.note : note,
      visibleTo === undefined ? current.visible_to : serializeVisibleTo(visibleTo),
      id
    );
    return this.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM availability WHERE id = ?').run(id);
  },

  /**
   * Replace all intervals for a user on a given owner-local day (slot-grid editor).
   * The day is the editing key; the client has already converted each interval to
   * UTC instants in the owner's zone. We delete by both the day label and the day's
   * UTC window so the right rows clear even if a row's day label is stale.
   */
  replaceDay(userId, day, intervals, { dayStartUtc, dayEndUtc } = {}) {
    const ins = db.prepare(
      `INSERT INTO availability (user_id, day, start_min, end_min, start_utc, end_utc, note, visible_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = db.transaction(() => {
      if (dayStartUtc != null && dayEndUtc != null) {
        db.prepare(
          'DELETE FROM availability WHERE user_id = ? AND (day = ? OR (start_utc >= ? AND start_utc < ?))'
        ).run(userId, day, dayStartUtc, dayEndUtc);
      } else {
        db.prepare('DELETE FROM availability WHERE user_id = ? AND day = ?').run(userId, day);
      }
      for (const iv of intervals) {
        ins.run(userId, day, iv.startMin, iv.endMin, iv.startUtc, iv.endUtc, iv.note ?? null, serializeVisibleTo(iv.visibleTo));
      }
    });
    tx();
    return this.listByUser(userId, { fromUtc: dayStartUtc, toUtc: dayEndUtc });
  },
};
