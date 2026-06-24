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
      <div className="grid__corner" />
      {days.map((d) => (
        <div key={toISODate(d)} className={`grid__dayhead ${isToday(d) ? 'is-today' : ''}`}>
          <span className="grid__dow">{weekdayShort(d)}</span>
          <span className="grid__date">{d.getDate()}</span>
        </div>
      ))}

      {slots.map((slot) => {
        const onHour = slot % 60 === 0;
        return (
          <Fragment key={slot}>
            <div className={`grid__time ${onHour ? 'grid__time--hour' : ''}`}>
              {onHour ? minToLabel(slot) : ''}
            </div>
            {isoList.map((iso) => {
              const { intensity = 0, highlight = false, title = '' } = getCell(iso, slot) || {};
              return (
                <div
                  key={iso}
                  className={`slot slot--ro ${highlight ? 'slot--common' : ''} ${onHour ? 'slot--hour' : ''}`}
                  style={!highlight && intensity > 0
                    ? { background: `rgba(127, 90, 240, ${0.15 + intensity * 0.75})` }
                    : undefined}
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
