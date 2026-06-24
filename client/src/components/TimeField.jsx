// 24-hour time entry (no AM/PM), in two interchangeable modes:
//  - 'text'   : type "18:30" on the keyboard (default; colon auto-inserted)
//  - 'select' : pick hours / minutes from dropdowns
// Always emits an "HH:MM" string via onChange. Replaces <input type="time">,
// whose 12/24h format follows the device locale and can't be forced to 24h.

import { useEffect, useState } from 'react';

const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const clampTime = (h, m) =>
  `${pad2(Math.max(0, Math.min(23, h)))}:${pad2(Math.max(0, Math.min(59, m)))}`;

export default function TimeField({ value, onChange, minuteStep = 5, mode = 'text' }) {
  return mode === 'select' ? (
    <SelectTime value={value} onChange={onChange} minuteStep={minuteStep} />
  ) : (
    <TextTime value={value} onChange={onChange} />
  );
}

function TextTime({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const onInput = (e) => {
    let v = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
    if (/^\d{3,}$/.test(v)) v = `${v.slice(0, 2)}:${v.slice(2)}`; // 1830 -> 18:30
    setDraft(v);
    const m = v.match(/^(\d{1,2}):(\d{2})$/);
    if (m && Number(m[1]) <= 23 && Number(m[2]) <= 59) {
      onChange(clampTime(Number(m[1]), Number(m[2])));
    }
  };

  const commit = (raw) => {
    const m = raw.match(/^(\d{1,2})[:.\s]?(\d{0,2})$/);
    if (!m) return setDraft(value); // revert junk to the last good value
    const next = clampTime(Number(m[1]), m[2] === '' ? 0 : Number(m[2]));
    setDraft(next);
    onChange(next);
  };

  return (
    <input
      className="time-field__text"
      type="text"
      inputMode="numeric"
      placeholder="ЧЧ:ММ"
      maxLength={5}
      value={draft}
      onChange={onInput}
      onBlur={(e) => commit(e.target.value)}
      aria-label="Время в формате ЧЧ:ММ"
    />
  );
}

function SelectTime({ value, onChange, minuteStep }) {
  const [h, m] = value.split(':').map(Number);
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);
  const set = (hh, mm) => onChange(`${pad2(hh)}:${pad2(mm)}`);

  return (
    <span className="time-field">
      <select className="time-field__sel" value={h} onChange={(e) => set(Number(e.target.value), m)} aria-label="Часы">
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>{pad2(hh)}</option>
        ))}
      </select>
      <span className="time-field__colon">:</span>
      <select className="time-field__sel" value={m} onChange={(e) => set(h, Number(e.target.value))} aria-label="Минуты">
        {minutes.map((mm) => (
          <option key={mm} value={mm}>{pad2(mm)}</option>
        ))}
      </select>
    </span>
  );
}
