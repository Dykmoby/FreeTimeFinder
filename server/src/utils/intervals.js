/**
 * Merge overlapping/touching intervals into a clean, sorted set.
 * Input/output: array of { startMin, endMin, note? }.
 * Notes are dropped on merge (kept from the first of a merged group).
 */
export function mergeIntervals(intervals) {
  const sorted = [...intervals]
    .filter((iv) => iv.endMin > iv.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, iv.endMin);
    } else {
      merged.push({ startMin: iv.startMin, endMin: iv.endMin, note: iv.note ?? null });
    }
  }
  return merged;
}
