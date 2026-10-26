import { addDays, daysInMonth, ymd } from './dates';

// Stored as JSON in trackers.recurrence (data-model §3).
export type Recurrence =
  | { type: 'none' }
  | { type: 'weekly' }
  | { type: 'twice_monthly'; days: [number, number] }
  | { type: 'monthly'; day: number }
  | { type: 'custom'; every: number; unit: 'day' | 'week' | 'month' };

// Days that don't exist in a month clamp to its last day (31 → Feb 28/29, Apr 30).
function clamped(year: number, month: number, day: number): string {
  return ymd(year, month, Math.min(day, daysInMonth(year, month)));
}

function shiftMonth(year: number, month: number, by: number): [number, number] {
  const index = year * 12 + (month - 1) + by;
  return [Math.floor(index / 12), (index % 12) + 1];
}

// The first date after `fromDate` matching any of `days` (days of the month, kept as anchors).
function nextMatchingDay(days: number[], fromDate: string): string {
  const [y, m] = fromDate.split('-').map(Number);
  for (const [year, month] of [[y, m], shiftMonth(y, m, 1)]) {
    const candidates = days.map((day) => clamped(year, month, day)).sort();
    const next = candidates.find((c) => c > fromDate);
    if (next) return next;
  }
  throw new Error('unreachable: next month always has a later date');
}

/** The next occurrence strictly after `fromDate`, or null for one-time trackers. */
export function nextOccurrence(recurrence: Recurrence, fromDate: string): string | null {
  switch (recurrence.type) {
    case 'none':
      return null;
    case 'weekly':
      return addDays(fromDate, 7);
    case 'twice_monthly':
      return nextMatchingDay(recurrence.days, fromDate);
    case 'monthly':
      return nextMatchingDay([recurrence.day], fromDate);
    case 'custom': {
      if (recurrence.unit === 'day') return addDays(fromDate, recurrence.every);
      if (recurrence.unit === 'week') return addDays(fromDate, recurrence.every * 7);
      // shortcut: custom-month JSON has no anchor day, so the anchor is fromDate's day
      // (every 3 months from Nov 30 → Feb 28 → May 28). Store a "day" if the spec adds one.
      const [y, m, d] = fromDate.split('-').map(Number);
      const [year, month] = shiftMonth(y, m, recurrence.every);
      return clamped(year, month, d);
    }
  }
}

/** How many occurrences, starting at `dueDate`, fall before `today` (i.e. are overdue). */
export function countOverdue(recurrence: Recurrence, dueDate: string, today: string): number {
  let count = 0;
  // Cap so a daily tracker left for years can't spin forever; "99 more" reads the same as more.
  for (let d: string | null = dueDate; d !== null && d < today && count < 99; d = nextOccurrence(recurrence, d)) {
    count++;
  }
  return count;
}
