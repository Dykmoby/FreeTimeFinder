import { SLOT_MIN } from './time.js';

// An interval is { startMin, endMin }. Lists are kept sorted & non-overlapping.

export function mergeIntervals(intervals) {
  const sorted = [...intervals]
    .filter((iv) => iv.endMin > iv.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.startMin <= last.endMin) last.endMin = Math.max(last.endMin, iv.endMin);
    else out.push({ startMin: iv.startMin, endMin: iv.endMin });
  }
  return out;
}

/** Turn a set/array of slot start-minutes into merged intervals. */
export function slotsToIntervals(slotStarts, size = SLOT_MIN) {
  return mergeIntervals([...slotStarts].map((s) => ({ startMin: s, endMin: s + size })));
}

/** Which grid slots (start-minutes) does this interval list cover? */
export function intervalsToSlotSet(intervals, slots, size = SLOT_MIN) {
  const set = new Set();
  for (const s of slots) {
    if (intervals.some((iv) => s >= iv.startMin && s + size <= iv.endMin)) set.add(s);
  }
  return set;
}

/** base minus holes (cuts the hole ranges out of base, splitting as needed). */
export function subtractIntervals(base, holes) {
  let result = mergeIntervals(base);
  for (const hole of mergeIntervals(holes)) {
    result = result.flatMap((iv) => {
      if (hole.endMin <= iv.startMin || hole.startMin >= iv.endMin) return [iv];
      const pieces = [];
      if (hole.startMin > iv.startMin) pieces.push({ startMin: iv.startMin, endMin: hole.startMin });
      if (hole.endMin < iv.endMin) pieces.push({ startMin: hole.endMin, endMin: iv.endMin });
      return pieces;
    });
  }
  return result;
}

/** Intersection of two interval lists. */
export function intersectTwo(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  const A = mergeIntervals(a);
  const B = mergeIntervals(b);
  while (i < A.length && j < B.length) {
    const start = Math.max(A[i].startMin, B[j].startMin);
    const end = Math.min(A[i].endMin, B[j].endMin);
    if (end > start) out.push({ startMin: start, endMin: end });
    if (A[i].endMin < B[j].endMin) i++;
    else j++;
  }
  return out;
}

/** Intersection common to every list (returns [] if any list is empty). */
export function intersectMany(lists) {
  if (!lists.length) return [];
  return lists.reduce((acc, list) => intersectTwo(acc, list), lists[0]);
}

export const intervalMinutes = (iv) => iv.endMin - iv.startMin;
export const totalMinutes = (list) => list.reduce((sum, iv) => sum + intervalMinutes(iv), 0);

/** Do two intervals share any minute? (Touching end-to-start is NOT an overlap.) */
export const overlaps = (a, b) => a.startMin < b.endMin && b.startMin < a.endMin;

/** Does `iv` overlap anything in `list`? */
export const hasOverlap = (iv, list) => list.some((other) => overlaps(iv, other));

// --- Audience-aware variants (per-interval visibility) ----------------------
// An interval may carry `visibleTo`: null/[] = everyone, else an array of ids.

/** Normalise an audience to null ("everyone") or a sorted, de-duped id array. */
export function normAudience(visibleTo) {
  if (!visibleTo || visibleTo.length === 0) return null;
  return [...new Set(visibleTo)].sort((a, b) => a - b);
}

/** A stable key for grouping intervals by who can see them. */
export function audienceKey(visibleTo) {
  const a = normAudience(visibleTo);
  return a ? a.join(',') : '*';
}

/** Merge intervals, only fusing neighbours that share the same audience. */
export function mergeByAudience(intervals) {
  const groups = new Map(); // key -> { visibleTo, items }
  for (const iv of intervals) {
    if (iv.endMin <= iv.startMin) continue;
    const key = audienceKey(iv.visibleTo);
    if (!groups.has(key)) groups.set(key, { visibleTo: normAudience(iv.visibleTo), items: [] });
    groups.get(key).items.push(iv);
  }
  const out = [];
  for (const { visibleTo, items } of groups.values()) {
    for (const m of mergeIntervals(items)) out.push({ ...m, visibleTo });
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

/** Subtract hole ranges from each interval, preserving each one's audience. */
export function subtractKeepAudience(base, holes) {
  const out = [];
  for (const iv of base) {
    for (const piece of subtractIntervals([iv], holes)) {
      out.push({ ...piece, visibleTo: normAudience(iv.visibleTo) });
    }
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}
