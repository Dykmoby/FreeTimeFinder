import { Availability } from '../models/availability.model.js';
import { Users } from '../models/user.model.js';
import { ApiError, asyncHandler, parseDay, parseMinute } from '../utils/http.js';

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
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null;
  const visibleTo = readVisibleTo(body.visibleTo);
  return { day, startMin, endMin, note, visibleTo };
}

// --- Current user's own availability --------------------------------------

export const listMine = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  res.json({ availability: Availability.listByUser(req.user.id, { from, to }) });
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
  const incoming = Array.isArray(req.body?.intervals) ? req.body.intervals : [];
  // The client sends an already-reconciled, non-overlapping set where each
  // interval carries its own audience, so we keep them distinct (merging here
  // would fuse blocks with different visibility). We only validate + drop empties.
  const cleaned = incoming
    .map((iv) => ({
      startMin: parseMinute(iv.startMin, 'startMin'),
      endMin: parseMinute(iv.endMin, 'endMin'),
      visibleTo: readVisibleTo(iv.visibleTo),
    }))
    .filter((iv) => iv.endMin > iv.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  res.json({ availability: Availability.replaceDay(req.user.id, day, cleaned) });
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
  const { from, to } = req.query;
  const availability = Availability.listAll({ from, to })
    .filter((iv) => isVisibleTo(iv, req.user.id))
    // Don't leak other people's audience choices to the viewer.
    .map(({ visibleTo, ...rest }) => rest); // eslint-disable-line no-unused-vars
  res.json({ users: Users.list(), availability });
});

/** Just the people list — used by the editor's visibility picker. */
export const listUsers = asyncHandler(async (_req, res) => {
  res.json({ users: Users.list() });
});
