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
  const schema = fs.readFileSync(config.paths.schemaFile, 'utf8');
  db.exec(schema);
  migrate();
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
}
