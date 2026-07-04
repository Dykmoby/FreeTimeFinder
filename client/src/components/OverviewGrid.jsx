import { Fragment } from 'react';
import { gridSlots, minToLabel, toISODate, weekdayShort, isToday } from '../lib/time.js';

/**
 * Read-only time grid for the shared view.
 * `getCell(iso, slot)` returns { intensity: 0..1, highlight?: boolean, title?: string }.
 */
export default function OverviewGrid({ days, getCell }) {
  const slots = gridSlots();
  const isoList = days.map(toISODate);

  return (
    <div className="grid grid--readonly" style={{ '--cols': days.length, '--rows': slots.length }}>
      <div className="grid__corner" style={{ gridRow: 1, gridColumn: 1 }} />
      <div className="grid__headbar" style={{ gridRow: 1, gridColumn: '2 / -1' }} />
      {days.map((d, di) => (
        <div
          key={toISODate(d)}
          className={`grid__dayhead ${isToday(d) ? 'is-today' : ''}`}
          style={{ gridRow: 1, gridColumn: di + 2 }}
        >
          <span className="grid__dow">{weekdayShort(d)}</span>
          <span className="grid__date">{d.getDate()}</span>
        </div>
      ))}

      {slots.map((slot, i) => {
        const onHour = slot % 60 === 0;
        const r = i + 2;
        return (
          <Fragment key={slot}>
            <div className={`grid__time ${onHour ? 'grid__time--hour' : ''}`} style={{ gridRow: r, gridColumn: 1 }}>
              {onHour ? minToLabel(slot) : ''}
            </div>
            {isoList.map((iso, d) => {
              const { intensity = 0, highlight = false, title = '' } = getCell(iso, slot) || {};
              const cellStyle = { gridRow: r, gridColumn: d + 2 };
              if (!highlight && intensity > 0) cellStyle.background = `rgba(127, 90, 240, ${0.15 + intensity * 0.75})`;
              return (
                <div
                  key={iso}
                  className={`slot slot--ro ${highlight ? 'slot--common' : ''} ${onHour ? 'slot--hour' : ''}`}
                  style={cellStyle}
                  title={title}
                />
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
