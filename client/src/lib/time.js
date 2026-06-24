// Time + date helpers. The app works in the browser's local timezone and
// represents a day as a 'YYYY-MM-DD' string and a time as minutes-from-midnight.

export const SLOT_MIN = 30; // grid granularity
export const GRID_START_MIN = 0; //       grid shows 00:00 ...
export const GRID_END_MIN = 24 * 60; //             ... 24:00

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const pad2 = (n) => String(n).padStart(2, '0');

export function minToLabel(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function labelToMin(label) {
  const [h, m] = label.split(':').map(Number);
  return h * 60 + m;
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 6x7 grid of Date objects covering the month that `date` belongs to. */
export function monthMatrix(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const weekdayShort = (date) => WEEKDAYS[(date.getDay() + 6) % 7];
export const monthName = (date) => MONTHS[date.getMonth()];

export function formatDayHuman(date) {
  return `${weekdayShort(date)}, ${date.getDate()} ${monthName(date).toLowerCase()}`;
}

export function sameMonth(a, b) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export function isToday(date) {
  return toISODate(date) === todayISO();
}

/** All slot start-minutes shown on the grid, e.g. [0, 30, ... 1410]. */
export function gridSlots(start = GRID_START_MIN, end = GRID_END_MIN, size = SLOT_MIN) {
  const slots = [];
  for (let m = start; m < end; m += size) slots.push(m);
  return slots;
}
