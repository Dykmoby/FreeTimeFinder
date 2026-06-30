import fs from 'node:fs';
import Database from 'better-sqlite3';
import { config } from '../config.js';

// Make sure the data directory exists before opening the file.
fs.mkdirSync(config.paths.serverRoot + '/data', { recursive: true });

export const db = new Database(config.paths.dbFile);

// Pragmas: WAL is friendlier for concurrent reads; foreign keys must be enabled per-connection.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Create tables from schema.sql if they don't exist yet, then run migrations. */
export function initSchema() {
  dropLegacyAvailability(); // before schema.sql, whose indexes reference new columns
  const schema = fs.readFileSync(config.paths.schemaFile, 'utf8');
  db.exec(schema);
  migrate();
}

/**
 * Timezone support: availability moved from purely owner-local time to canonical
 * UTC instants (start_utc/end_utc). A legacy row's original zone is unknown, so it
 * can't be converted — drop the table so schema.sql recreates it empty. Runs before
 * schema.sql (its indexes reference start_utc, which the old table lacks).
 * (Intentional: the project owner signed off on clearing existing marks.)
 */
function dropLegacyAvailability() {
  const cols = db.prepare('PRAGMA table_info(availability)').all();
  if (cols.length && !cols.some((c) => c.name === 'start_utc')) {
    db.exec('DROP TABLE availability');
  }
}

/** Add a column to a table if it isn't there yet (SQLite has no IF NOT EXISTS). */
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Small forward-only migrations for databases created before a column existed. */
function migrate() {
  // Per-interval visibility (NULL = everyone, else JSON array of user ids).
  addColumnIfMissing('availability', 'visible_to', 'TEXT');
  // Chosen gradient preset for the fallback (no-image) avatar.
  addColumnIfMissing('users', 'avatar_color', 'TEXT');
  // Each user's IANA timezone (e.g. 'Europe/Moscow'); NULL until first detected.
  addColumnIfMissing('users', 'timezone', 'TEXT');
}
