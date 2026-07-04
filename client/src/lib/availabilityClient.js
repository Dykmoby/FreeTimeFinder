// Plumbing that bridges the timezone-agnostic CalendarEditor to the UTC API.
// The editor works in owner-local (day, minutes); here we translate that to/from
// the canonical UTC instants the server stores, using a given IANA `tz` (the
// owner's own zone for one's own calendar, the target user's zone for an admin).

import { api } from '../api.js';
import { localRangeToUtc, zonedToUtcMs } from './tz.js';

/**
 * Build { fetchRange, replaceDay, removeInterval } for a CalendarEditor.
 *   tz       — the zone the edited calendar is expressed in.
 *   listPath — GET endpoint for a range, e.g. '/availability/mine'.
 *   dayPath  — PUT endpoint for a whole-day replace, e.g. '/availability/mine/day'.
 *   delPath  — (id) => DELETE endpoint for one interval.
 */
export function makeEditorPlumbing({ tz, listPath, dayPath, delPath }) {
  const fetchRange = async (from, to) => {
    const { fromUtc, toUtc } = localRangeToUtc(from, to, tz);
    const { availability } = await api(`${listPath}?fromUtc=${fromUtc}&toUtc=${toUtc}`);
    // Editing endpoints return owner-local day/startMin/endMin already in `tz`.
    return availability;
  };

  const replaceDay = (iso, intervals) =>
    api(dayPath, {
      method: 'PUT',
      body: {
        day: iso,
        dayStartUtc: zonedToUtcMs(iso, 0, tz),
        dayEndUtc: zonedToUtcMs(iso, 1440, tz),
        intervals: intervals.map((iv) => ({
          startMin: iv.startMin,
          endMin: iv.endMin,
          startUtc: zonedToUtcMs(iso, iv.startMin, tz),
          endUtc: zonedToUtcMs(iso, iv.endMin, tz),
          visibleTo: iv.visibleTo ?? null,
        })),
      },
    });

  const removeInterval = (id) => api(delPath(id), { method: 'DELETE' });

  return { fetchRange, replaceDay, removeInterval };
}
