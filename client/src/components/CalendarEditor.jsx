import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SlotGrid from './SlotGrid.jsx';
import TimeField from './TimeField.jsx';
import { useLocalStorage } from '../lib/useLocalStorage.js';
import {
  SLOT_MIN,
  addDays,
  formatDayHuman,
  isToday,
  labelToMin,
  minToLabel,
  monthMatrix,
  monthName,
  sameMonth,
  toISODate,
  weekDays,
} from '../lib/time.js';
import {
  hasOverlap,
  mergeByAudience,
  subtractKeepAudience,
  totalMinutes,
} from '../lib/intervals.js';

const VIEWS = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
];

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Group a flat availability list into { 'YYYY-MM-DD': [intervals] }. */
function groupByDay(list) {
  const map = {};
  for (const iv of list) (map[iv.day] ||= []).push(iv);
  return map;
}

/**
 * The full free-time editing surface: month / week / day views with grid
 * painting, edge-resize, precise entry, per-row editing, and per-interval
 * visibility. The same surface drives a person editing their own calendar and
 * an admin editing someone else's — only the data plumbing differs, so it's
 * injected:
 *   - `fetchRange(from, to)` → Promise<interval[]>
 *   - `replaceDay(iso, intervals)` → Promise (persist one whole day)
 *   - `removeInterval(id)` → Promise (delete one interval)
 *   - `people` — who an interval can be limited to (everyone but the owner)
 * Keep the injected callbacks stable (wrap in useCallback) — `load` re-runs
 * whenever the visible range changes, not on every render.
 */
export default function CalendarEditor({
  heading,
  people = [],
  fetchRange,
  replaceDay,
  removeInterval,
  onError,
  compact = false,
  initialView = 'week',
}) {
  const [view, setView] = useState(initialView);
  const [cursor, setCursor] = useState(() => new Date());
  const [byDay, setByDay] = useState({});
  const [error, setError] = useState('');

  // Hold the latest plumbing in a ref so `load` only depends on the range.
  const fns = useRef({ fetchRange, replaceDay, removeInterval });
  fns.current = { fetchRange, replaceDay, removeInterval };
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const report = useCallback((msg) => {
    if (onErrorRef.current) onErrorRef.current(msg);
    else setError(msg);
  }, []);

  // Visible day range for the current view.
  const range = useMemo(() => {
    if (view === 'month') {
      const cells = monthMatrix(cursor);
      return { from: toISODate(cells[0]), to: toISODate(cells[cells.length - 1]), days: cells };
    }
    if (view === 'week') {
      const days = weekDays(cursor);
      return { from: toISODate(days[0]), to: toISODate(days[6]), days };
    }
    const iso = toISODate(cursor);
    return { from: iso, to: iso, days: [cursor] };
  }, [view, cursor]);

  const load = useCallback(async () => {
    try {
      const list = await fns.current.fetchRange(range.from, range.to);
      setByDay(groupByDay(list));
    } catch (err) {
      report(err.message);
    }
  }, [range.from, range.to, report]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Editing ---------------------------------------------------------------

  async function persistDay(iso, intervals) {
    try {
      await fns.current.replaceDay(iso, intervals);
      load();
    } catch (err) {
      report(err.message);
      load();
    }
  }

  // Grid drag commit: reconcile touched slots, keeping each interval's audience.
  // Painted-in slots default to "everyone"; blocks with different visibility
  // stay separate (mergeByAudience won't fuse them).
  function commitDay(iso, mode, slots) {
    const holes = slots.map((s) => ({ startMin: s, endMin: s + SLOT_MIN }));
    const base = subtractKeepAudience(byDay[iso] || [], holes);
    const additions = mode === 'add'
      ? slots.map((s) => ({ startMin: s, endMin: s + SLOT_MIN, visibleTo: null }))
      : [];
    const next = mergeByAudience([...base, ...additions]);
    setByDay((prev) => ({ ...prev, [iso]: next }));
    persistDay(iso, next);
  }

  // Apply a reconciled day: optimistic update + persist. Neighbours that share
  // an audience are fused by mergeByAudience.
  function applyDay(iso, intervals) {
    const next = mergeByAudience(intervals);
    setByDay((prev) => ({ ...prev, [iso]: next }));
    persistDay(iso, next);
  }

  function setAudience(id, iso, visibleTo) {
    const day = byDay[iso] || [];
    applyDay(iso, day.map((iv) => (iv.id === id ? { ...iv, visibleTo } : iv)));
  }

  function resizeInterval(iso, id, startMin, endMin) {
    const day = byDay[iso] || [];
    applyDay(iso, day.map((iv) => (iv.id === id ? { ...iv, startMin, endMin } : iv)));
  }

  function addPreciseInterval(iso, startMin, endMin) {
    const day = byDay[iso] || [];
    if (hasOverlap({ startMin, endMin }, day)) {
      return 'Этот интервал пересекается с уже отмеченным';
    }
    applyDay(iso, [...day, { startMin, endMin, visibleTo: null }]);
    return null;
  }

  function editInterval(iso, id, startMin, endMin) {
    if (endMin <= startMin) return 'Время окончания должно быть позже начала';
    const day = byDay[iso] || [];
    if (hasOverlap({ startMin, endMin }, day.filter((iv) => iv.id !== id))) {
      return 'Этот интервал пересекается с другим';
    }
    applyDay(iso, day.map((iv) => (iv.id === id ? { ...iv, startMin, endMin } : iv)));
    return null;
  }

  async function deleteInterval(id) {
    try {
      await fns.current.removeInterval(id);
      load();
    } catch (err) {
      report(err.message);
    }
  }

  // --- Navigation ------------------------------------------------------------

  function step(dir) {
    if (view === 'month') setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
    else setCursor((c) => addDays(c, dir * (view === 'week' ? 7 : 1)));
  }

  const rangeLabel =
    view === 'month'
      ? `${monthName(cursor)} ${cursor.getFullYear()}`
      : view === 'week'
        ? `${range.from} — ${range.to}`
        : formatDayHuman(cursor);

  return (
    <div className="stack">
      <div className="page__head">
        {heading}
        <div className={`seg ${compact ? 'seg--mini' : ''}`}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`seg__btn ${view === v.id ? 'is-active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? 'toolbar toolbar--compact' : 'toolbar'}>
        <div className="toolbar__nav">
          <button className="btn btn--ghost btn--sm" onClick={() => step(-1)}>←</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setCursor(new Date())}>Сегодня</button>
          <button className="btn btn--ghost btn--sm" onClick={() => step(1)}>→</button>
        </div>
        <div className="toolbar__title">{rangeLabel}</div>
      </div>

      {!onError && error && <div className="alert">{error}</div>}

      {view === 'month' && (
        <MonthView
          cursor={cursor}
          days={range.days}
          byDay={byDay}
          onPickDay={(d) => {
            setCursor(d);
            setView('day');
          }}
        />
      )}

      {view === 'week' && (
        <div className="card card--grid">
          <SlotGrid
            days={range.days}
            availabilityByDay={byDay}
            onCommitDay={commitDay}
            people={people}
            onSetAudience={setAudience}
            onResizeInterval={resizeInterval}
            onDayHeaderClick={(d) => {
              setCursor(d);
              setView('day');
            }}
          />
        </div>
      )}

      {view === 'day' && (
        <DayView
          cursor={cursor}
          byDay={byDay}
          people={people}
          onCommitDay={commitDay}
          onSetAudience={setAudience}
          onResizeInterval={resizeInterval}
          onAddPrecise={addPreciseInterval}
          onEdit={editInterval}
          onDelete={deleteInterval}
        />
      )}
    </div>
  );
}

// --- Month -------------------------------------------------------------------

function MonthView({ cursor, days, byDay, onPickDay }) {
  return (
    <div className="card">
      <div className="month">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="month__head">{w}</div>
        ))}
        {days.map((d) => {
          const iso = toISODate(d);
          const minutes = totalMinutes(byDay[iso] || []);
          const hours = minutes / 60;
          return (
            <button
              key={iso}
              className={`month__cell ${sameMonth(d, cursor) ? '' : 'is-dim'} ${isToday(d) ? 'is-today' : ''}`}
              onClick={() => onPickDay(d)}
            >
              <span className="month__num">{d.getDate()}</span>
              {minutes > 0 && (
                <span className="month__badge">{hours % 1 === 0 ? hours : hours.toFixed(1)} ч</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Day ---------------------------------------------------------------------

function DayView({ cursor, byDay, people, onCommitDay, onSetAudience, onResizeInterval, onAddPrecise, onEdit, onDelete }) {
  const iso = toISODate(cursor);
  const intervals = [...(byDay[iso] || [])].sort((a, b) => a.startMin - b.startMin);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('20:00');
  const [err, setErr] = useState('');
  // Remembered across reloads: type the time, or pick it from dropdowns.
  const [timeMode, setTimeMode] = useLocalStorage('fff_time_input_mode', 'text');

  function submit(e) {
    e.preventDefault();
    setErr('');
    const s = labelToMin(start);
    const en = labelToMin(end);
    if (en <= s) return setErr('Время окончания должно быть позже начала');
    const problem = onAddPrecise(iso, s, en);
    if (problem) setErr(problem);
  }

  return (
    <div className="day-layout">
      <div className="card card--grid">
        <SlotGrid
          days={[cursor]}
          availabilityByDay={byDay}
          onCommitDay={onCommitDay}
          people={people}
          onSetAudience={onSetAudience}
          onResizeInterval={onResizeInterval}
        />
      </div>

      <div className="stack">
        <form className="card" onSubmit={submit}>
          <div className="card__head">
            <div className="card__title">Точный интервал</div>
            <div className="seg seg--mini" role="group" aria-label="Способ ввода времени">
              <button type="button" className={`seg__btn ${timeMode === 'text' ? 'is-active' : ''}`} onClick={() => setTimeMode('text')}>
                Клавиатура
              </button>
              <button type="button" className={`seg__btn ${timeMode === 'select' ? 'is-active' : ''}`} onClick={() => setTimeMode('select')}>
                Списки
              </button>
            </div>
          </div>
          <div className="time-row">
            <TimeField value={start} onChange={setStart} mode={timeMode} />
            <span className="muted">—</span>
            <TimeField value={end} onChange={setEnd} mode={timeMode} />
            <button className="btn btn--primary btn--sm">Добавить</button>
          </div>
          {err && <div className="alert">{err}</div>}
        </form>

        <div className="card">
          <div className="card__title">Интервалы на день</div>
          {intervals.length === 0 ? (
            <p className="muted">Пока ничего не отмечено.</p>
          ) : (
            <ul className="interval-list">
              {intervals.map((iv) => (
                <IntervalRow
                  key={iv.id}
                  iv={iv}
                  timeMode={timeMode}
                  onEdit={(s, e) => onEdit(iso, iv.id, s, e)}
                  onDelete={() => onDelete(iv.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function IntervalRow({ iv, timeMode, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [err, setErr] = useState('');

  function begin() {
    setStart(minToLabel(iv.startMin));
    setEnd(minToLabel(iv.endMin));
    setErr('');
    setEditing(true);
  }

  function save() {
    const problem = onEdit(labelToMin(start), labelToMin(end));
    if (problem) setErr(problem);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <li>
        <span className="interval-list__time">
          {minToLabel(iv.startMin)} – {minToLabel(iv.endMin)}
        </span>
        <span className="interval-list__actions">
          <button className="icon-btn" title="Изменить" onClick={begin}>✎</button>
          <button className="icon-btn icon-btn--danger" title="Удалить" onClick={onDelete}>✕</button>
        </span>
      </li>
    );
  }

  return (
    <li className="interval-list__editing">
      <div className="interval-edit">
        <TimeField value={start} onChange={setStart} mode={timeMode} />
        <span className="muted">—</span>
        <TimeField value={end} onChange={setEnd} mode={timeMode} />
        <button className="btn btn--primary btn--sm" onClick={save}>Сохранить</button>
        <button className="icon-btn" title="Отмена" onClick={() => setEditing(false)}>✕</button>
      </div>
      {err && <div className="alert">{err}</div>}
    </li>
  );
}
