-- Database schema for Free Time Finder.
-- Kept intentionally small; new features should add new tables/columns here.

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  nickname             TEXT    NOT NULL,
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar               TEXT,                       -- filename inside /uploads, or NULL
  avatar_color         TEXT,                       -- chosen gradient preset id for the fallback avatar
  must_change_password INTEGER NOT NULL DEFAULT 0, -- 1 = force change on next login
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per free-time interval a user marks.
-- A "slot grid" selection and a "precise interval" both end up here as intervals.
CREATE TABLE IF NOT EXISTS availability (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  day        TEXT    NOT NULL,                       -- 'YYYY-MM-DD'
  start_min  INTEGER NOT NULL CHECK (start_min >= 0 AND start_min <= 1440),
  end_min    INTEGER NOT NULL CHECK (end_min   >  0 AND end_min   <= 1440),
  note       TEXT,
  -- Who may see this interval on the shared pages. NULL = everyone (default);
  -- otherwise a JSON array of user ids. The owner always sees their own.
  visible_to TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (end_min > start_min),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_availability_user_day ON availability (user_id, day);
CREATE INDEX IF NOT EXISTS idx_availability_day      ON availability (day);
