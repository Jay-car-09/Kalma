import { describe, expect, it } from '@jest/globals';

import type { Tracker } from '@/data/trackers';

import { computeDashboard, type DashboardPayment } from '../dashboard';

const TODAY = '2026-10-27'; // October 2026: the 1st is a Thursday, so it has five Thursdays

let n = 0;
const tracker = (o: Partial<Tracker> = {}): Tracker => ({
  id: `t${++n}`,
  direction: 'owe',
  name: `Tracker ${n}`,
  amountCentavos: 100000,
  debtType: 'other',
  dueDate: '2026-11-15',
  recurrence: { type: 'monthly', day: 15 },
  urgency: 'normal',
  notify: false,
  status: 'active',
  startingBalanceCentavos: null,
  interestRate: null,
  interestPeriod: null,
  statementCutoffDay: null,
  notes: null,
  remainingCentavos: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...o,
});

const payment = (o: Partial<DashboardPayment> = {}): DashboardPayment => ({
  trackerId: 'x',
  direction: 'owe',
  debtType: 'other',
  amountCentavos: 100000,
  paidOn: '2026-10-10',
  occurrenceDueDate: '2026-10-15',
  ...o,
});

const dash = (trackers: Tracker[], payments: DashboardPayment[] = []) => computeDashboard(trackers, payments, TODAY);

describe('Due this month', () => {
  it('weekly tracker in a 5-week month counts all five occurrences', () => {
    const weekly = tracker({ dueDate: '2026-10-01', recurrence: { type: 'weekly' }, amountCentavos: 50000 });
    expect(dash([weekly]).dueThisMonth).toEqual({ paid: 0, unpaid: 5 * 50000 });
  });

  it('twice-monthly with one occurrence paid splits paid / unpaid', () => {
    const twice = tracker({
      dueDate: '2026-10-30', // Oct 15 already settled
      recurrence: { type: 'twice_monthly', days: [15, 30] },
      amountCentavos: 150000,
    });
    const paid = payment({ trackerId: twice.id, amountCentavos: 150000, occurrenceDueDate: '2026-10-15' });
    expect(dash([twice], [paid]).dueThisMonth).toEqual({ paid: 150000, unpaid: 150000 });
  });

  it("excludes an overdue occurrence from last month, but it's in Needs attention", () => {
    const late = tracker({ dueDate: '2026-09-15' }); // Sep 15 and Oct 15 both unpaid
    const d = dash([late]);
    expect(d.dueThisMonth.unpaid).toBe(100000); // only Oct 15
    expect(d.overdue.map((t) => t.id)).toEqual([late.id]);
  });

  it('a one-time debt paid this month (now Done) stays in "paid of"', () => {
    const done = tracker({ status: 'done', recurrence: { type: 'none' }, dueDate: '2026-10-05' });
    const paid = payment({ trackerId: done.id, occurrenceDueDate: '2026-10-05', amountCentavos: 80000 });
    expect(dash([done], [paid]).dueThisMonth).toEqual({ paid: 80000, unpaid: 0 });
  });

  it('ignores next month, owed-to-me trackers and owed-to-me payments', () => {
    const d = dash(
      [tracker({ dueDate: '2026-11-01' }), tracker({ direction: 'owed_to_me', dueDate: '2026-10-30' })],
      [payment({ direction: 'owed_to_me' })],
    );
    expect(d.dueThisMonth).toEqual({ paid: 0, unpaid: 0 });
  });
});

describe('Next due and overdue', () => {
  it('next due is the soonest active due date from today; overdue is oldest first', () => {
    const soon = tracker({ dueDate: '2026-10-28' });
    const later = tracker({ dueDate: '2026-11-02' });
    const old = tracker({ dueDate: '2026-09-01' });
    const older = tracker({ dueDate: '2026-08-01' });
    const doneOld = tracker({ dueDate: '2026-07-01', status: 'done' });
    const d = dash([later, soon, old, older, doneOld]);
    expect(d.nextDue?.id).toBe(soon.id);
    expect(d.overdue.map((t) => t.id)).toEqual([older.id, old.id]);
  });

  it('due today counts as next due, not overdue', () => {
    const d = dash([tracker({ dueDate: TODAY })]);
    expect(d.nextDue?.dueDate).toBe(TODAY);
    expect(d.overdue).toEqual([]);
  });
});

describe('Totals', () => {
  it('total debt is null when no active I-owe tracker tracks a balance', () => {
    expect(dash([tracker(), tracker({ direction: 'owed_to_me', remainingCentavos: 5000 })]).totalDebt).toBeNull();
  });

  it('total debt sums remaining balances of active I-owe trackers only', () => {
    const d = dash([
      tracker({ remainingCentavos: 500000 }),
      tracker({ remainingCentavos: 200000 }),
      tracker(), // no balance tracked
      tracker({ remainingCentavos: 0, status: 'done' }),
      tracker({ direction: 'owed_to_me', remainingCentavos: 999 }),
    ]);
    expect(d.totalDebt).toBe(700000);
  });

  it('owed to you: unpaid this month plus total remaining, never netted with debt', () => {
    const d = dash([
      tracker({ direction: 'owed_to_me', dueDate: '2026-10-30', amountCentavos: 50000, remainingCentavos: 300000 }),
      tracker({ remainingCentavos: 900000 }),
    ]);
    expect(d.owedToYou).toEqual({ unpaid: 50000, remaining: 300000 });
    expect(d.totalDebt).toBe(900000);
    expect(dash([tracker({ direction: 'owed_to_me', dueDate: '2026-10-30' })]).owedToYou.remaining).toBeNull();
  });
});

describe('Insights', () => {
  it('payments per month: last 6 months, I-owe only, by paid_on month', () => {
    const d = dash(
      [],
      [
        payment({ paidOn: '2026-04-30', amountCentavos: 1 }), // 7 months ago: out
        payment({ paidOn: '2026-05-02', amountCentavos: 20000 }),
        payment({ paidOn: '2026-10-01', amountCentavos: 30000 }),
        payment({ paidOn: '2026-10-20', amountCentavos: 40000 }),
        payment({ paidOn: '2026-10-21', direction: 'owed_to_me', amountCentavos: 99999 }),
      ],
    );
    expect(d.paymentsByMonth).toEqual([
      { month: '2026-05', total: 20000 },
      { month: '2026-06', total: 0 },
      { month: '2026-07', total: 0 },
      { month: '2026-08', total: 0 },
      { month: '2026-09', total: 0 },
      { month: '2026-10', total: 70000 },
    ]);
  });

  it('6-month window crosses a year boundary', () => {
    const d = computeDashboard([], [], '2027-02-10');
    expect(d.paymentsByMonth.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('on-time record: paid_on on or before the due date it settled, I-owe only', () => {
    const d = dash(
      [],
      [
        payment({ paidOn: '2026-10-10', occurrenceDueDate: '2026-10-15' }), // early
        payment({ paidOn: '2026-10-15', occurrenceDueDate: '2026-10-15' }), // on the day
        payment({ paidOn: '2026-10-20', occurrenceDueDate: '2026-10-15' }), // late
        payment({ paidOn: '2026-10-20', occurrenceDueDate: '2026-10-15', direction: 'owed_to_me' }),
      ],
    );
    expect(d.onTime).toEqual({ onTime: 2, total: 3 });
  });

  it('by debt type: amount due this month per type, largest first', () => {
    const card = tracker({ debtType: 'credit_card', dueDate: '2026-10-28', amountCentavos: 300000 });
    const sss = tracker({ debtType: 'sss_loan', dueDate: '2026-10-30', amountCentavos: 100000 });
    const nextMonth = tracker({ debtType: 'bnpl', dueDate: '2026-11-05' });
    const paid = payment({ debtType: 'sss_loan', occurrenceDueDate: '2026-10-05', amountCentavos: 250000 });
    expect(dash([card, sss, nextMonth], [paid]).dueByType).toEqual([
      { type: 'sss_loan', total: 350000 },
      { type: 'credit_card', total: 300000 },
    ]);
  });

  it('by urgency counts active trackers only', () => {
    const d = dash([
      tracker({ urgency: 'high' }),
      tracker({ urgency: 'high', direction: 'owed_to_me' }),
      tracker({ urgency: 'low' }),
      tracker({ urgency: 'low', status: 'done' }),
    ]);
    expect(d.byUrgency).toEqual({ low: 1, normal: 0, high: 2 });
  });
});
