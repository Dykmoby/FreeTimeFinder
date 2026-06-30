import { Availability } from '../models/availability.model.js';
import { Users } from '../models/user.model.js';
import { ApiError, asyncHandler, parseDay, parseEpochMs, parseMinute } from '../utils/http.js';

/** Read an optional UTC-instant window [fromUtc, toUtc) from a request query. */
export function readUtcRange(query = {}) {
  const range = {};
  if (query.fromUtc !== undefined) range.fromUtc = parseEpochMs(query.fromUtc, 'fromUtc');
  if (query.toUtc !== undefined) range.toUtc = parseEpochMs(query.toUtc, 'toUtc');
  return range;
}

/** Read a visibility list from a payload: an array of user ids, or null = everyone. */
export function readVisibleTo(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) throw new ApiError(400, 'visibleTo must be an array of user ids');
  const ids = [...new Set(value.map(Number).filter(Number.isInteger))];
  return ids.length ? ids : null;
}

/** Validate and normalise a single interval payload. */
export function readInterval(body) {
  const day = parseDay(body.day);
  const startMin = parseMinute(body.startMin, 'startMin');
  const endMin = parseMinute(body.endMin, 'endMin');
  if (endMin <= startMin) throw new ApiError(400, 'endMin must be greater than startMin');
  const startUtc = parseEpochMs(body.startUtc, 'startUtc');
  const endUtc = parseEpochMs(body.endUtc, 'endUtc');
  if (endUtc <= startUtc) throw new ApiError(400, 'endUtc must be greater than startUtc');
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null;
  const visibleTo = readVisibleTo(body.visibleTo);
  return { day, startMin, endMin, startUtc, endUtc, note, visibleTo };
}

/**
 * Validate the intervals for a whole-day replace (used by the slot-grid editor).
 * The client sends an already-reconciled, non-overlapping set where each interval
 * carries its own audience and pre-converted UTC instants (the owner's zone lives
 * on the client). We keep them distinct — merging here would fuse blocks with
 * different visibility — and only validate + drop empties.
 */
export function readDayIntervals(body) {
  const incoming = Array.isArray(body?.intervals) ? body.intervals : [];
  return incoming
    .map((iv) => ({
      startMin: parseMinute(iv.startMin, 'startMin'),
      endMin: parseMinute(iv.endMin, 'endMin'),
      startUtc: parseEpochMs(iv.startUtc, 'startUtc'),
      endUtc: parseEpochMs(iv.endUtc, 'endUtc'),
      visibleTo: readVisibleTo(iv.visibleTo),
    }))
    .filter((iv) => iv.endMin > iv.startMin && iv.endUtc > iv.startUtc)
    .sort((a, b) => a.startMin - b.startMin);
}

/** Read the optional UTC window of the local day being replaced (for safe deletes). */
export function readDayWindow(body = {}) {
  const window = {};
  if (body.dayStartUtc !== undefined) window.dayStartUtc = parseEpochMs(body.dayStartUtc, 'dayStartUtc');
  if (body.dayEndUtc !== undefined) window.dayEndUtc = parseEpochMs(body.dayEndUtc, 'dayEndUtc');
  return window;
}

// --- Current user's own availability --------------------------------------

export const listMine = asyncHandler(async (req, res) => {
  res.json({ availability: Availability.listByUser(req.user.id, readUtcRange(req.query)) });
});

export const createMine = asyncHandler(async (req, res) => {
  const iv = readInterval(req.body || {});
  res.status(201).json({ interval: Availability.create({ userId: req.user.id, ...iv }) });
});

export const updateMine = asyncHandler(async (req, res) => {
  const existing = Availability.findById(Number(req.params.id));
  if (!existing || existing.userId !== req.user.id) throw new ApiError(404, 'Interval not found');
  const iv = readInterval({ ...existing, ...req.body });
  res.json({ interval: Availability.update(existing.id, iv) });
});

export const deleteMine = asyncHandler(async (req, res) => {
  const existing = Availability.findById(Number(req.params.id));
  if (!existing || existing.userId !== req.user.id) throw new ApiError(404, 'Interval not found');
  Availability.remove(existing.id);
  res.json({ ok: true });
});

/** Replace every interval the user has on one day (used by the slot-grid editor). */
export const replaceMyDay = asyncHandler(async (req, res) => {
  const day = parseDay(req.body?.day);
  const cleaned = readDayIntervals(req.body);
  res.json({ availability: Availability.replaceDay(req.user.id, day, cleaned, readDayWindow(req.body)) });
});

// --- Shared / overview -----------------------------------------------------

/** Can `viewerId` see this interval? Owner always can; otherwise honour visibleTo. */
function isVisibleTo(interval, viewerId) {
  if (interval.userId === viewerId) return true;
  if (!interval.visibleTo) return true; // null/empty = everyone
  return interval.visibleTo.includes(viewerId);
}

/** Everyone's availability in a range (filtered to what the viewer may see). */
export const listEveryone = asyncHandler(async (req, res) => {
  const availability = Availability.listAll(readUtcRange(req.query))
    .filter((iv) => isVisibleTo(iv, req.user.id))
    // Hand out UTC instants only — the viewer's client renders them in its own
    // zone. Don't leak the owner-local fields or other people's audience choices.
    .map(({ id, userId, startUtc, endUtc, note }) => ({ id, userId, startUtc, endUtc, note }));
  res.json({ users: Users.list(), availability });
});

/** Just the people list — used by the editor's visibility picker. */
export const listUsers = asyncHandler(async (_req, res) => {
  res.json({ users: Users.list() });
});
