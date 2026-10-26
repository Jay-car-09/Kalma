import { describe, expect, it } from '@jest/globals';

import type { Tracker } from '@/data/trackers';
import i18n from '@/i18n';

import { reminderMessages } from '../messages';
import { planReminders, type PlannedReminder, type ReminderTracker } from '../plan';

// "Now" is Tue 27 Oct 2026, 8:00 AM local; reminders fire at 9:00 AM local.
const NOW = new Date(2026, 9, 27, 8, 0);
const SETTINGS = { reminderTime: '09:00' };

const at = (date: string, time = '09:00') => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
};

let n = 0;
const tracker = (o: Partial<ReminderTracker> = {}): ReminderTracker => ({
  id: `t${String(++n).padStart(3, '0')}`,
  dueDate: '2026-11-10',
  recurrence: { type: 'none' },
  urgency: 'normal',
  notify: true,
  status: 'active',
  ...o,
});

const plan = (trackers: ReminderTracker[], isPaid = false, now = NOW) =>
  planReminders(trackers, now, SETTINGS, isPaid);
const summary = (reminders: PlannedReminder[]) => reminders.map((r) => [r.fireAt, r.kind]);

describe('urgency offsets (one-time, due Nov 10)', () => {
  it('Low: due day, one nudge the day after', () => {
    expect(summary(plan([tracker({ urgency: 'low' })]))).toEqual([
      [at('2026-11-10'), 'due_day'],
      [at('2026-11-11'), 'overdue'],
    ]);
  });

  it('Normal: 3 days before, due day, nudges 1 and 3 days after', () => {
    expect(summary(plan([tracker({ urgency: 'normal' })]))).toEqual([
      [at('2026-11-07'), 'before_due'],
      [at('2026-11-10'), 'due_day'],
      [at('2026-11-11'), 'overdue'],
      [at('2026-11-13'), 'overdue'],
    ]);
  });

  it('High: 7, 3, 1 days before, due day, daily nudges for 7 days', () => {
    expect(summary(plan([tracker({ urgency: 'high' })]))).toEqual([
      [at('2026-11-03'), 'before_due'],
      [at('2026-11-07'), 'before_due'],
      [at('2026-11-09'), 'before_due'],
      [at('2026-11-10'), 'due_day'],
      ...['11', '12', '13', '14', '15', '16', '17'].map((d) => [at(`2026-11-${d}`), 'overdue']),
    ]);
  });

  it('uses the reminder time from settings', () => {
    const [first] = planReminders([tracker({ urgency: 'low' })], NOW, { reminderTime: '19:30' }, false);
    expect(first.fireAt).toBe(at('2026-11-10', '19:30'));
  });
});

describe('who gets reminders', () => {
  it('excludes notify off, done, archived and deleted trackers', () => {
    expect(
      plan([
        tracker({ notify: false }),
        tracker({ status: 'done' }),
        tracker({ status: 'archived' }),
        tracker({ deletedAt: '2026-10-20T00:00:00.000Z' }),
      ]),
    ).toEqual([]);
  });

  it('Free plans for at most 5 trackers, earliest due first; Paid has no cap', () => {
    const dates = ['2026-11-20', '2026-11-02', '2026-11-15', '2026-11-05', '2026-11-25', '2026-11-01', '2026-11-10'];
    const trackers = dates.map((dueDate) => tracker({ dueDate, urgency: 'low' }));
    const ids = (r: PlannedReminder[]) => [...new Set(r.map((x) => x.trackerId))].sort();

    const earliestFive = [...trackers].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    expect(ids(plan(trackers, false))).toEqual(earliestFive.map((t) => t.id).sort());
    expect(ids(plan(trackers, true))).toHaveLength(7);
  });
});

describe('timing rules', () => {
  it('skips times already in the past', () => {
    // Due tomorrow: "3 days before" (Oct 25) has passed.
    expect(summary(plan([tracker({ dueDate: '2026-10-28' })]))).toEqual([
      [at('2026-10-28'), 'due_day'],
      [at('2026-10-29'), 'overdue'],
      [at('2026-10-31'), 'overdue'],
    ]);
    // Due today: 9:00 is still ahead at 8:00, but not at 10:00.
    const today = tracker({ dueDate: '2026-10-27', urgency: 'low' });
    expect(plan([today])[0].kind).toBe('due_day');
    expect(summary(plan([today], false, new Date(2026, 9, 27, 10, 0)))).toEqual([[at('2026-10-28'), 'overdue']]);
  });

  it('short intervals: a daily High tracker gets no "before" reminders', () => {
    const daily = tracker({ urgency: 'high', dueDate: '2026-10-27', recurrence: { type: 'custom', every: 1, unit: 'day' } });
    const reminders = plan([daily], true);
    expect(reminders.some((r) => r.kind === 'before_due')).toBe(false);
    expect(reminders.filter((r) => r.kind === 'due_day').slice(0, 3).map((r) => r.dueDate)).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
  });

  it('short intervals: weekly High skips "7 days before" (it lands on the previous due date)', () => {
    const weekly = tracker({ urgency: 'high', dueDate: '2026-11-03', recurrence: { type: 'weekly' } });
    const befores = plan([weekly], true).filter((r) => r.kind === 'before_due' && r.dueDate <= '2026-11-10');
    expect(befores.map((r) => [r.dueDate, r.days])).toEqual([
      ['2026-11-03', -3],
      ['2026-11-03', -1],
      ['2026-11-10', -3],
      ['2026-11-10', -1],
    ]);
  });

  it('overdue nudges only for the current due date', () => {
    // Due yesterday (Oct 26), monthly: nudges for Oct 26 only, none for Nov 26 or Dec 26.
    const monthly = tracker({ dueDate: '2026-10-26', recurrence: { type: 'monthly', day: 26 } });
    const reminders = plan([monthly]);
    expect(reminders.filter((r) => r.kind === 'overdue').map((r) => [r.fireAt, r.dueDate])).toEqual([
      [at('2026-10-27'), '2026-10-26'],
      [at('2026-10-29'), '2026-10-26'],
    ]);
    expect(reminders.filter((r) => r.kind === 'due_day').map((r) => r.dueDate)).toEqual(['2026-11-26', '2026-12-26']);
  });

  it('plans recurring occurrences within the next 60 days (to Dec 26)', () => {
    const weekly = tracker({ urgency: 'low', dueDate: '2026-10-28', recurrence: { type: 'weekly' } });
    const dueDays = plan([weekly]).filter((r) => r.kind === 'due_day').map((r) => r.dueDate);
    expect(dueDays).toEqual([
      '2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25',
      '2026-12-02', '2026-12-09', '2026-12-16', '2026-12-23',
    ]);
  });

  it('keeps only the nearest 60, sorted by time', () => {
    const many = Array.from({ length: 10 }, () =>
      tracker({ urgency: 'high', dueDate: '2026-10-27', recurrence: { type: 'custom', every: 1, unit: 'day' } }),
    );
    const all = planReminders(many, NOW, SETTINGS, true);
    expect(all).toHaveLength(60);
    expect(all.map((r) => r.fireAt)).toEqual([...all.map((r) => r.fireAt)].sort());
    expect(all[0].fireAt).toBe(at('2026-10-27'));
  });
});

describe('message wording', () => {
  const debt = (o: Partial<Tracker>): Tracker => ({
    id: 'x',
    direction: 'owe',
    name: 'Ate Joy',
    amountCentavos: 245000,
    debtType: 'informal',
    dueDate: '2026-11-10',
    recurrence: { type: 'none' },
    urgency: 'normal',
    notify: true,
    status: 'active',
    startingBalanceCentavos: null,
    interestRate: null,
    interestPeriod: null,
    statementCutoffDay: null,
    notes: null,
    remainingCentavos: null,
    ...o,
  });
  const reminder = (days: number): PlannedReminder => ({
    trackerId: 'x',
    fireAt: '',
    kind: days < 0 ? 'before_due' : days === 0 ? 'due_day' : 'overdue',
    dueDate: '2026-11-10',
    days,
  });
  const body = (tracker: Tracker, days: number, showAmounts = false) =>
    reminderMessages.debt({ tracker, reminder: reminder(days), t: i18n.t.bind(i18n), showAmounts }).body;

  it('I owe: "Due …" wording, title is the tracker name', async () => {
    await i18n.changeLanguage('en');
    const owe = debt({});
    expect(reminderMessages.debt({ tracker: owe, reminder: reminder(-3), t: i18n.t.bind(i18n), showAmounts: false }).title).toBe('Ate Joy');
    expect([body(owe, -3), body(owe, 0), body(owe, 1), body(owe, 3)]).toEqual([
      'Due in 3 days',
      'Due today',
      'Was due yesterday',
      'Was due 3 days ago',
    ]);
  });

  it('owed to me: "Expected …" wording', async () => {
    await i18n.changeLanguage('en');
    const owed = debt({ direction: 'owed_to_me' });
    expect([body(owed, -3), body(owed, -1), body(owed, 0), body(owed, 1)]).toEqual([
      'Expected in 3 days',
      'Expected tomorrow',
      'Expected today',
      'Was expected yesterday',
    ]);
  });

  it('amounts are hidden unless the setting is on', async () => {
    await i18n.changeLanguage('en');
    expect(body(debt({}), 0)).toBe('Due today');
    expect(body(debt({}), 0, true)).toBe('Due today · ₱2,450.00');
  });

  it('follows the app language', async () => {
    await i18n.changeLanguage('tl');
    expect(body(debt({ direction: 'owed_to_me' }), -3)).toBe('Inaasahan sa loob ng 3 araw');
    await i18n.changeLanguage('en');
  });
});

describe('Tagalog numbers', () => {
  it('2 and 3 days never read as "tomorrow" (Tagalog plural rules group 1–3)', async () => {
    await i18n.changeLanguage('tl');
    const t = i18n.t.bind(i18n);
    expect(t('home.inDays', { count: 3 })).toBe('Sa loob ng 3 araw');
    expect(t('tracker.repeatSummary.day', { count: 2 })).toBe('Kada 2 araw');
    await i18n.changeLanguage('en');
  });
});
