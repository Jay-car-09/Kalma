import type { TFunction } from 'i18next';

import { formatWeekday } from './dates';
import type { Recurrence } from './recurrence';

/** 15 → "15th" in English; Tagalog strings carry their own "ika-", so just the number. */
export function ordinalDay(day: number, language: string): string {
  if (language === 'tl') return String(day);
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return day + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]);
}

/** Readable repeat rule, e.g. "Monthly on the 15th" — shared by the tracker screen and CSV export. */
export function describeRecurrence(r: Recurrence, dueDate: string, t: TFunction, language: string): string {
  switch (r.type) {
    case 'none':
      return t('tracker.repeat.none');
    case 'weekly':
      return t('tracker.repeatSummary.weekly', { weekday: formatWeekday(dueDate, language) });
    case 'twice_monthly':
      return t('tracker.repeatSummary.twice', {
        first: ordinalDay(r.days[0], language),
        second: ordinalDay(r.days[1], language),
      });
    case 'monthly':
      return t('tracker.repeatSummary.monthly', { day: ordinalDay(r.day, language) });
    case 'custom':
      // "Every 1 day" reads as "Every day"; kept separate because Tagalog plurals lump 1–3 together.
      if (r.every === 1) {
        return t(`tracker.repeatSummary.every${r.unit === 'day' ? 'Day' : r.unit === 'week' ? 'Week' : 'Month'}`);
      }
      return t(`tracker.repeatSummary.${r.unit}`, { count: r.every });
  }
}
