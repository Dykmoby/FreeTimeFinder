// Timezone helpers. The DB stores absolute UTC instants (epoch ms); each user
// edits/reads in their own IANA zone. These convert between a wall-clock time
// in a zone (a 'YYYY-MM-DD' day + minutes-from-midnight) and a UTC instant,
// using only the built-in Intl API — no external dependency, no configuration.

import { addDays, parseISODate, toISODate } from './time.js';

/** The browser's own IANA zone, e.g. 'Europe/Moscow'. Auto-detected, no setup. */
export function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const formatters = new Map();
function formatterFor(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of UTC instant `utcMs` as seen in `tz`. */
function wallPartsInZone(utcMs, tz) {
  const m = {};
  for (const p of formatterFor(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') m[p.type] = Number(p.value);
  }
  if (m.hour === 24) m.hour = 0; // some engines emit '24' for midnight
  return m;
}

/** Offset of `tz` at instant `utcMs`, in ms (zone wall-clock − UTC). */
function offsetMsAt(utcMs, tz) {
  const w = wallPartsInZone(utcMs, tz);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUTC - utcMs;
}

/**
 * UTC instant (epoch ms) for a wall-clock time in `tz`.
 * `day` is 'YYYY-MM-DD', `min` is minutes-from-midnight (0..1440; 1440 = next 00:00).
 */
export function zonedToUtcMs(day, min, tz) {
  const [y, mo, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(min / 60), min % 60);
  // Two passes settle DST/offset boundaries: the offset at the guess instant may
  // differ from the offset at the instant the guess actually resolves to.
  let result = guess - offsetMsAt(guess, tz);
  result = guess - offsetMsAt(result, tz);
  return result;
}

/** Wall-clock { day, min } of UTC instant `ms` as seen in `tz`. */
export function utcMsToZoned(ms, tz) {
  const w = wallPartsInZone(ms, tz);
  const day = `${String(w.year).padStart(4, '0')}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
  return { day, min: w.hour * 60 + w.minute };
}

/**
 * Split a UTC interval into per-local-day pieces in `tz`. A block that crosses
 * local midnight becomes several pieces, each inside one day's 00:00–24:00 grid.
 * Returns [{ day, startMin, endMin }].
 */
export function splitUtcToLocalDays(startUtc, endUtc, tz) {
  const s = utcMsToZoned(startUtc, tz);
  const e = utcMsToZoned(endUtc, tz);
  const pieces = [];
  let day = s.day;
  let startMin = s.min;
  for (let guard = 0; guard < 400; guard++) {
    if (day === e.day) {
      if (e.min > startMin) pieces.push({ day, startMin, endMin: e.min });
      break;
    }
    pieces.push({ day, startMin, endMin: 1440 });
    day = toISODate(addDays(parseISODate(day), 1));
    startMin = 0;
  }
  return pieces;
}

/** Expand server UTC intervals into per-local-day client intervals in `tz`. */
export function serverIntervalsToLocal(list, tz) {
  const out = [];
  for (const iv of list) {
    for (const piece of splitUtcToLocalDays(iv.startUtc, iv.endUtc, tz)) {
      out.push({ ...iv, ...piece });
    }
  }
  return out;
}

/** UTC window { fromUtc, toUtc } covering local days [fromIso, toIso] in `tz`. */
export function localRangeToUtc(fromIso, toIso, tz) {
  return {
    fromUtc: zonedToUtcMs(fromIso, 0, tz),
    toUtc: zonedToUtcMs(toIso, 1440, tz),
  };
}
