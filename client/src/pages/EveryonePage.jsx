import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import OverviewGrid from '../components/OverviewGrid.jsx';
import { useLocalStorage } from '../lib/useLocalStorage.js';
import {
  SLOT_MIN,
  addDays,
  formatDayHuman,
  minToLabel,
  toISODate,
  weekDays,
} from '../lib/time.js';
import { intersectMany } from '../lib/intervals.js';
import { getLocalTimeZone, localRangeToUtc, serverIntervalsToLocal } from '../lib/tz.js';

const freeAt = (intervals, slot) =>
  intervals.some((iv) => iv.startMin <= slot && iv.endMin >= slot + SLOT_MIN);

export default function EveryonePage() {
  const { user } = useAuth();
  const tz = useMemo(() => getLocalTimeZone(), []);
  const [cursor, setCursor] = useState(() => new Date());
  const [users, setUsers] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState('');

  // Persisted across reloads. We store the *exceptions* to each mode's default
  // so newly-added users keep the intended default automatically:
  //  - "Все": everyone is shown unless explicitly hidden here.
  //  - "Пересечение": nobody is compared unless explicitly added here.
  const [mode, setMode] = useLocalStorage('fff_everyone_mode', 'all'); // 'all' | 'intersect'
  const [hidden, , toggleHidden] = useLocalStorage('fff_everyone_hidden', []);
  const [compared, , toggleCompared] = useLocalStorage('fff_everyone_compare', []);

  const days = useMemo(() => weekDays(cursor), [cursor]);
  const from = toISODate(days[0]);
  const to = toISODate(days[6]);

  useEffect(() => {
    const { fromUtc, toUtc } = localRangeToUtc(from, to, tz);
    api(`/availability/everyone?fromUtc=${fromUtc}&toUtc=${toUtc}`)
      .then(({ users, availability }) => {
        setUsers(users);
        // Server returns UTC instants; render them in the viewer's own zone,
        // splitting any block that crosses local midnight into per-day pieces.
        setAvailability(serverIntervalsToLocal(availability, tz));
      })
      .catch((e) => setError(e.message));
  }, [from, to, tz]);

  const others = useMemo(() => users.filter((u) => u.id !== user.id), [users, user.id]);
  // Show yourself first in "Кто отмечен", then everyone else.
  const usersMeFirst = useMemo(() => {
    const me = users.find((u) => u.id === user.id);
    return me ? [me, ...others] : others;
  }, [users, others, user.id]);

  // Resolve the stored exceptions against the live user list.
  const shownIds = useMemo(
    () => users.filter((u) => !hidden.includes(u.id)).map((u) => u.id),
    [users, hidden],
  );
  const compareIds = useMemo(
    () => others.filter((u) => compared.includes(u.id)).map((u) => u.id),
    [others, compared],
  );

  // byUserDay[userId][iso] = intervals[]
  const byUserDay = useMemo(() => {
    const m = {};
    for (const iv of availability) {
      (m[iv.userId] ||= {})[iv.day] ||= [];
      m[iv.userId][iv.day].push(iv);
    }
    return m;
  }, [availability]);

  const includedIds = useMemo(() => [user.id, ...compareIds], [user.id, compareIds]);

  // "Все": how many of the shown people are free in each slot.
  const getCellAll = (iso, slot) => {
    const total = shownIds.length;
    if (!total) return {};
    let count = 0;
    for (const id of shownIds) if (freeAt(byUserDay[id]?.[iso] || [], slot)) count++;
    return { intensity: count / total, title: count ? `${count} из ${total} свободны` : '' };
  };

  // "Пересечение": highlight a slot only if everyone included is free.
  const getCellIntersect = (iso, slot) => {
    if (includedIds.length < 2) return {};
    const all = includedIds.every((id) => freeAt(byUserDay[id]?.[iso] || [], slot));
    return all ? { highlight: true } : {};
  };

  // Common free intervals per day for the included people (for the summary).
  const commonByDay = useMemo(() => {
    if (includedIds.length < 2) return [];
    const res = [];
    for (const d of days) {
      const iso = toISODate(d);
      const lists = includedIds.map((id) => byUserDay[id]?.[iso] || []);
      if (lists.some((l) => l.length === 0)) continue;
      const common = intersectMany(lists);
      if (common.length) res.push({ iso, day: d, intervals: common });
    }
    return res;
  }, [includedIds, byUserDay, days]);

  return (
    <div className="stack">
      <div className="page__head">
        <h1 className="page__title">Свободное время всех</h1>
        <div className="seg">
          <button className={`seg__btn ${mode === 'all' ? 'is-active' : ''}`} onClick={() => setMode('all')}>
            Все
          </button>
          <button className={`seg__btn ${mode === 'intersect' ? 'is-active' : ''}`} onClick={() => setMode('intersect')}>
            Пересечение
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__nav">
          <button className="btn btn--ghost btn--sm" onClick={() => setCursor((c) => addDays(c, -7))}>←</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setCursor(new Date())}>Эта неделя</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setCursor((c) => addDays(c, 7))}>→</button>
        </div>
        <div className="toolbar__title">{from} — {to}</div>
      </div>

      {error && <div className="alert">{error}</div>}

      {/* Person selector (top) — what to show / who to compare. */}
      {mode === 'all' ? (
        <div className="card people">
          <div className="card__title">Кто отмечен ({shownIds.length} из {users.length})</div>
          <div className="people__chips">
            {usersMeFirst.map((u) => (
              <button
                key={u.id}
                className={`chip ${shownIds.includes(u.id) ? 'chip--on' : ''} ${u.id === user.id ? 'chip--me' : ''}`}
                onClick={() => toggleHidden(u.id)}
              >
                <Avatar user={u} size={22} /> {u.nickname}{u.id === user.id && ' (вы)'}
              </button>
            ))}
            {users.length === 0 && <span className="muted">Пользователей пока нет.</span>}
          </div>
          <p className="hint">Чем ярче ячейка — тем больше выбранных людей свободно в это время.</p>
        </div>
      ) : (
        <div className="card people">
          <div className="card__title">С кем сравнить</div>
          <div className="people__chips">
            <span className="chip chip--me"><Avatar user={user} size={22} /> Вы</span>
            {others.map((u) => (
              <button
                key={u.id}
                className={`chip ${compared.includes(u.id) ? 'chip--on' : ''}`}
                onClick={() => toggleCompared(u.id)}
              >
                <Avatar user={u} size={22} /> {u.nickname}
              </button>
            ))}
            {others.length === 0 && <span className="muted">Других пользователей пока нет.</span>}
          </div>
        </div>
      )}

      <div className="card card--grid">
        <OverviewGrid days={days} getCell={mode === 'all' ? getCellAll : getCellIntersect} />
      </div>

      {mode === 'intersect' && (
        <div className="card">
          <div className="card__title">Когда вы свободны вместе</div>
          {includedIds.length < 2 ? (
            <p className="muted">Выберите хотя бы одного человека для сравнения.</p>
          ) : commonByDay.length === 0 ? (
            <p className="muted">На этой неделе общего свободного времени не нашлось.</p>
          ) : (
            <ul className="common-list">
              {commonByDay.map(({ iso, day, intervals }) => (
                <li key={iso}>
                  <span className="common-list__day">{formatDayHuman(day)}</span>
                  <span className="common-list__times">
                    {intervals.map((iv, i) => (
                      <span key={i} className="pill">
                        {minToLabel(iv.startMin)}–{minToLabel(iv.endMin)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
