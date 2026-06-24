# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Free Time Finder — a small self-hosted web app (UI in Russian) where friends mark when
they're free and a shared "Все" (Everyone) page shows overlaps. Accounts are
admin-provisioned (no self-registration). React + Vite frontend, Express + SQLite backend.

## Commands

**Node is installed only via nvm on this machine — `node`/`npm` are NOT on PATH in a fresh
shell.** Source nvm first in any Bash command that runs node/npm:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use default >/dev/null
```

From the repo root:

- `npm run install:all` — install root + `server/` + `client/` deps
- `npm run dev` — run server (`:4000`, `node --watch`) and Vite client (`:5173`) together; client proxies `/api` and `/uploads` to the server
- `npm run build` — build the client into `client/dist`
- `npm start` — production: server alone serves API **and** the built client on one port
- `npm run deploy` — `scripts/deploy.sh`: sources nvm → install → build → `systemctl restart freetimefinder` → health-check. Run as `bash scripts/deploy.sh` from a bare shell.

There is **no lint or test tooling** configured (the `eslint-disable` comments are
vestigial; no ESLint config or test runner is installed). Don't suggest `npm test`/`npm run lint`.

First run seeds an admin account from `server/.env` (defaults `admin`/`admin`). Copy
`server/.env.example` → `server/.env` and set `JWT_SECRET` before doing anything real.

## Architecture

### One server, two modes
`server/src/app.js` always mounts the API under `/api` and serves `/uploads`. **If
`client/dist` exists** it also serves the built SPA and falls back to `index.html` for
client-side routes — so in production a single Express process is the whole app. In dev the
client runs separately under Vite and proxies to the API. `client/src/api.js` always calls
same-origin `/api/...`, so the same code works in both modes.

### Data model (the core abstraction)
Everything revolves around **availability intervals**, one row per free-time block
(`server/src/db/schema.sql`). Time is stored as **minutes-from-midnight** (`start_min`,
`end_min`, 0–1440) for a given `day` (`'YYYY-MM-DD'`, in the browser's local timezone). Both
the half-hour slot grid and the "precise interval" UI produce the same interval rows.

Each interval has **`visible_to`**: `NULL`/empty = everyone, else a JSON array of user ids
allowed to see it on shared pages (the owner always sees their own). This per-interval
audience is load-bearing across the stack — see the audience rules below.

### Interval logic lives on the client
The math for merging, subtracting, intersecting, and overlap-testing intervals is in
**`client/src/lib/intervals.js`**; time/date helpers and grid constants are in
**`client/src/lib/time.js`** (`SLOT_MIN = 30`, grid spans `00:00–24:00`). The "common free
time" feature is `intersectMany` over per-user interval lists. The server does **not**
re-merge day edits (see next point).

### Audience-aware day reconcile (don't break this)
When the grid editor saves a day, it sends an **already-reconciled, non-overlapping** set of
intervals (each carrying its own `visibleTo`) to `PUT /availability/mine/day`
(`replaceMyDay`). The server validates and stores them **as-is without merging** — merging
server-side would fuse adjacent blocks that have *different* audiences. The client uses the
audience-aware variants `mergeByAudience` / `subtractKeepAudience` (only fuses neighbours
with the same audience). Admin's `replaceUserDay` deliberately mirrors this behaviour.
`GET /availability/everyone` filters each interval by the viewer **and strips `visibleTo`**
so audiences never leak.

### One editor, two hosts
**`client/src/components/CalendarEditor.jsx`** contains the entire editing surface
(month/week/day views, grid painting, edge-resize, precise-add, per-row edit, visibility
picker, all day-level reducers). Both `CalendarPage` (own calendar, `/availability/mine*`)
and `AdminPage`'s embedded editor (someone else's, `/admin/users/:id/availability*`) render
it, injecting only `fetchRange` / `replaceDay` / `removeInterval` and the `people` list.
**Don't fork this logic back into the pages.** See the `ui-mobile-and-grid` memory for the
many mobile/touch/grid interaction invariants this component must preserve.

### Backend layering
Standard Express layering under `server/src/`: `routes/` → `controllers/` → `models/`
(thin data access over `better-sqlite3`). `db/index.js` opens the DB (WAL, foreign keys on),
runs `schema.sql`, then applies forward-only migrations via `addColumnIfMissing` (SQLite has
no `ADD COLUMN IF NOT EXISTS`) — **add new columns there, idempotently**, not by editing
existing schema in place on a live DB. `utils/http.js` provides `asyncHandler`, `ApiError`,
and the `parseDay`/`parseMinute` validators; the central error handler in `app.js` turns
`ApiError`/Multer errors into JSON responses.

### Auth
JWT Bearer tokens (`utils/token.js`), bcrypt password hashes. `requireAuth` attaches
`req.user`; `requireAdmin` gates the whole `/admin` router. Users have a
`must_change_password` flag (admin-issued temp passwords force a change on next login →
`/change-password`). Token lives in `localStorage` (`fff_token`).

### Data on disk
SQLite DB at `server/data/app.db` (+ WAL files) and avatars in `server/uploads/`. Both are
gitignored; backing up = copying those two directories.

## Production

Deployed on a Raspberry Pi as the `freetimefinder` systemd service (runs `node src/index.js`
from `server/`, `NODE_ENV=production`), behind **Caddy** as an HTTPS reverse-proxy
(Let's Encrypt cert for a DuckDNS domain) → `localhost:4000`. Router forwards 80/443 to
**Caddy**, not the app. The systemd unit pins an absolute nvm node path — update it if node
is upgraded. Details and ops commands are in the `deployment-pi-caddy` memory.
