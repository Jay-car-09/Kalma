import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import i18n from '@/i18n';

import { describeRecurrence, ordinalDay } from '../recurrenceText';

const t = i18n.t.bind(i18n);
const en = (r: Parameters<typeof describeRecurrence>[0], dueDate = '2026-10-27') =>
  describeRecurrence(r, dueDate, t, 'en');

describe('readable recurrence text', () => {
  beforeAll(() => i18n.changeLanguage('en'));
  afterAll(() => i18n.changeLanguage('en'));

  it('English ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 15, 21, 22, 23, 30, 31].map((d) => ordinalDay(d, 'en'))).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '15th', '21st', '22nd', '23rd', '30th', '31st',
    ]);
  });

  it('every recurrence type reads naturally', () => {
    expect(en({ type: 'none' })).toBe('One-time');
    expect(en({ type: 'weekly' }, '2026-10-27')).toBe('Weekly on Tuesday');
    expect(en({ type: 'monthly', day: 15 })).toBe('Monthly on the 15th');
    expect(en({ type: 'monthly', day: 31 })).toBe('Monthly on the 31st');
    expect(en({ type: 'twice_monthly', days: [15, 30] })).toBe('Twice a month on the 15th and 30th');
    expect(en({ type: 'custom', every: 1, unit: 'week' })).toBe('Every week');
    expect(en({ type: 'custom', every: 3, unit: 'month' })).toBe('Every 3 months');
    expect(en({ type: 'custom', every: 10, unit: 'day' })).toBe('Every 10 days');
  });

  it('Tagalog', async () => {
    await i18n.changeLanguage('tl');
    expect(describeRecurrence({ type: 'monthly', day: 15 }, '2026-10-15', t, 'tl')).toBe('Buwanan tuwing ika-15');
    expect(describeRecurrence({ type: 'custom', every: 2, unit: 'day' }, '2026-10-15', t, 'tl')).toBe('Kada 2 araw');
  });
});
