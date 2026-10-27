// Calendar dates are 'YYYY-MM-DD' strings in the user's local calendar (data-model §1.4).
// Arithmetic runs in UTC so daylight-saving shifts can never move a date.

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  const now = new Date();
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Local-calendar Date (for the date picker) <-> 'YYYY-MM-DD'.
export function fromLocalDate(date: Date): string {
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function toLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: string, language: string): string {
  const d = toUTC(date);
  const sameYear = date.slice(0, 4) === today().slice(0, 4);
  return new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/** 'YYYY-MM' for the month `offset` months from the month of `date` (offset −1 = last month). */
export function monthKey(date: string, offset = 0): string {
  const d = toUTC(date.slice(0, 8) + '01');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return fromUTC(d).slice(0, 7);
}

/** Month name for a 'YYYY-MM' key or a date, e.g. "October" (long) or "Oct" (short). */
export function formatMonth(date: string, language: string, width: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', {
    month: width,
    timeZone: 'UTC',
  }).format(toUTC(date.slice(0, 7) + '-01'));
}

/** 'HH:MM' → localized clock time, e.g. "9:00 AM". */
export function formatTime(time: string, language: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, h, m),
  );
}

/** Weekday name for a date, e.g. "Tuesday" / "Martes". */
export function formatWeekday(date: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'long', timeZone: 'UTC' }).format(
    toUTC(date),
  );
}
