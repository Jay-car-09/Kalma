import { describe, expect, it } from '@jest/globals';

import { nextOccurrence, previousOccurrence, type Recurrence } from '../recurrence';

describe('nextOccurrence', () => {
  it('one-time has no next occurrence', () => {
    expect(nextOccurrence({ type: 'none' }, '2026-10-27')).toBeNull();
  });

  it('weekly adds 7 days, across a year end', () => {
    expect(nextOccurrence({ type: 'weekly' }, '2026-10-27')).toBe('2026-11-03');
    expect(nextOccurrence({ type: 'weekly' }, '2026-12-28')).toBe('2027-01-04');
  });

  describe('monthly, anchor 31', () => {
    const monthly31 = { type: 'monthly', day: 31 } as const;

    it('clamps to Feb 28, then returns to Mar 31', () => {
      expect(nextOccurrence(monthly31, '2027-01-31')).toBe('2027-02-28');
      expect(nextOccurrence(monthly31, '2027-02-28')).toBe('2027-03-31');
    });

    it('clamps to Feb 29 in a leap year', () => {
      expect(nextOccurrence(monthly31, '2028-01-31')).toBe('2028-02-29');
    });

    it('clamps to Apr 30, then returns to May 31', () => {
      expect(nextOccurrence(monthly31, '2027-03-31')).toBe('2027-04-30');
      expect(nextOccurrence(monthly31, '2027-04-30')).toBe('2027-05-31');
    });

    it('rolls over the year', () => {
      expect(nextOccurrence(monthly31, '2026-12-31')).toBe('2027-01-31');
    });
  });

  describe('twice a month, days 15 and 30', () => {
    const twice: Recurrence = { type: 'twice_monthly', days: [15, 30] };

    it('in February: 15 → 28 (30 clamps) → Mar 15', () => {
      expect(nextOccurrence(twice, '2027-01-30')).toBe('2027-02-15');
      expect(nextOccurrence(twice, '2027-02-15')).toBe('2027-02-28');
      expect(nextOccurrence(twice, '2027-02-28')).toBe('2027-03-15');
    });

    it('in a leap February: 30 clamps to 29', () => {
      expect(nextOccurrence(twice, '2028-02-15')).toBe('2028-02-29');
    });

    it('returns to the 30th after February', () => {
      expect(nextOccurrence(twice, '2027-03-15')).toBe('2027-03-30');
    });
  });

  describe('custom', () => {
    it('every N days just adds', () => {
      expect(nextOccurrence({ type: 'custom', every: 10, unit: 'day' }, '2027-02-25')).toBe(
        '2027-03-07',
      );
    });

    it('every N weeks adds 7×N days', () => {
      expect(nextOccurrence({ type: 'custom', every: 2, unit: 'week' }, '2026-10-27')).toBe(
        '2026-11-10',
      );
    });

    it('every N months clamps like monthly', () => {
      expect(nextOccurrence({ type: 'custom', every: 1, unit: 'month' }, '2027-01-31')).toBe(
        '2027-02-28',
      );
      expect(nextOccurrence({ type: 'custom', every: 3, unit: 'month' }, '2026-11-30')).toBe(
        '2027-02-28',
      );
      expect(nextOccurrence({ type: 'custom', every: 6, unit: 'month' }, '2026-10-27')).toBe(
        '2027-04-27',
      );
    });
  });
});

describe('previousOccurrence', () => {
  it('steps back one occurrence for every recurrence type', () => {
    expect(previousOccurrence({ type: 'none' }, '2026-11-15')).toBeNull();
    expect(previousOccurrence({ type: 'weekly' }, '2026-11-03')).toBe('2026-10-27');
    expect(previousOccurrence({ type: 'monthly', day: 31 }, '2027-03-31')).toBe('2027-02-28');
    expect(previousOccurrence({ type: 'twice_monthly', days: [15, 30] }, '2027-03-15')).toBe('2027-02-28');
    expect(previousOccurrence({ type: 'twice_monthly', days: [15, 30] }, '2027-02-28')).toBe('2027-02-15');
    expect(previousOccurrence({ type: 'custom', every: 1, unit: 'day' }, '2026-10-28')).toBe('2026-10-27');
    expect(previousOccurrence({ type: 'custom', every: 2, unit: 'week' }, '2026-11-10')).toBe('2026-10-27');
    expect(previousOccurrence({ type: 'custom', every: 3, unit: 'month' }, '2027-02-28')).toBe('2026-11-28');
  });
});
