import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { countOverdue } from '@/lib/recurrence';

import type { TrackerInput } from '../trackers';

jest.mock('../db'); // src/data/__mocks__/db.ts — real SQL on Node's SQLite
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const { db } = require('../db');
const { migrate } = require('../migrations');
const trackers = require('../trackers') as typeof import('../trackers');
const payments = require('../payments') as typeof import('../payments');

const monthly15 = { type: 'monthly', day: 15 } as const;

const input = (overrides: Partial<TrackerInput> = {}): TrackerInput => ({
  direction: 'owe',
  name: 'Home Credit',
  amountCentavos: 250000,
  debtType: 'personal_loan',
  dueDate: '2026-11-15',
  recurrence: monthly15,
  urgency: 'normal',
  notify: true,
  startingBalanceCentavos: null,
  interestRate: null,
  interestPeriod: null,
  statementCutoffDay: null,
  notes: null,
  ...overrides,
});

const pay = (trackerId: string, amountCentavos = 250000) =>
  payments.markPaid(trackerId, { amountCentavos, paidOn: '2026-10-27', note: null });

const get = async (id: string) => (await trackers.getTracker(id))!;

beforeEach(async () => {
  db.reset();
  await migrate(db);
});

describe('Mark Paid', () => {
  it('recurring: settles the current due date and advances to the next one', async () => {
    const id = await trackers.createTracker(input(), false);
    await pay(id);

    expect(await get(id)).toMatchObject({ dueDate: '2026-12-15', status: 'active', notify: true });
    const [entry] = await payments.listPayments(id);
    expect(entry).toMatchObject({ kind: 'payment', amountCentavos: 250000, occurrenceDueDate: '2026-11-15' });
  });

  it('one-time: becomes Done with notify off', async () => {
    const id = await trackers.createTracker(input({ recurrence: { type: 'none' } }), false);
    await pay(id);

    expect(await get(id)).toMatchObject({ dueDate: '2026-11-15', status: 'done', notify: false });
  });

  it('tracked balance reaching zero: becomes Done with notify off', async () => {
    const id = await trackers.createTracker(input({ startingBalanceCentavos: 500000 }), false);

    await pay(id);
    expect(await get(id)).toMatchObject({ status: 'active', remainingCentavos: 250000 });

    await pay(id);
    expect(await get(id)).toMatchObject({ status: 'done', notify: false, remainingCentavos: 0 });
  });

  it('two missed occurrences are settled oldest first', async () => {
    const id = await trackers.createTracker(input({ dueDate: '2026-08-15' }), false);
    expect(countOverdue(monthly15, '2026-08-15', '2026-10-27')).toBe(3); // Aug, Sep, Oct

    await pay(id);
    expect((await get(id)).dueDate).toBe('2026-09-15');
    expect(countOverdue(monthly15, '2026-09-15', '2026-10-27')).toBe(2); // "2 more overdue"

    await pay(id);
    expect((await get(id)).dueDate).toBe('2026-10-15');
    const settled = (await payments.listPayments(id)).map((p) => p.occurrenceDueDate).sort();
    expect(settled).toEqual(['2026-08-15', '2026-09-15']);
  });

  it('refuses archived or done trackers, and zero amounts', async () => {
    const id = await trackers.createTracker(input({ recurrence: { type: 'none' } }), false);
    await expect(pay(id, 0)).rejects.toThrow();
    await pay(id);
    await expect(pay(id)).rejects.toThrow(); // now Done
  });
});

describe('Delete payment (also Undo)', () => {
  it('deleting the latest payment moves due_date back', async () => {
    const id = await trackers.createTracker(input(), false);
    const first = await pay(id);
    const second = await pay(id);
    expect((await get(id)).dueDate).toBe('2027-01-15');

    await payments.deletePayment(second);
    expect((await get(id)).dueDate).toBe('2026-12-15');
    await payments.deletePayment(first);
    expect((await get(id)).dueDate).toBe('2026-11-15');
  });

  it('deleting an older payment leaves due_date alone', async () => {
    const id = await trackers.createTracker(input(), false);
    const first = await pay(id);
    await pay(id);

    await payments.deletePayment(first);
    expect((await get(id)).dueDate).toBe('2027-01-15');
    expect(await payments.listPayments(id)).toHaveLength(1);
  });

  it('restores Done to Active (one-time)', async () => {
    const id = await trackers.createTracker(input({ recurrence: { type: 'none' } }), false);
    const paymentId = await pay(id);
    expect((await get(id)).status).toBe('done');

    await payments.deletePayment(paymentId);
    expect(await get(id)).toMatchObject({ status: 'active', dueDate: '2026-11-15' });
  });

  it('restores Done to Active (balance paid off)', async () => {
    const id = await trackers.createTracker(input({ startingBalanceCentavos: 250000 }), false);
    const paymentId = await pay(id);
    expect(await get(id)).toMatchObject({ status: 'done', dueDate: '2026-12-15' });

    await payments.deletePayment(paymentId);
    expect(await get(id)).toMatchObject({ status: 'active', dueDate: '2026-11-15', remainingCentavos: 250000 });
  });
});

describe('Remaining balance', () => {
  it('= starting − payments + adjustments, recalculated after deletes', async () => {
    const id = await trackers.createTracker(input({ startingBalanceCentavos: 1000000 }), false);
    await pay(id, 200000);
    expect((await get(id)).remainingCentavos).toBe(800000);

    // New credit card purchases: balance goes up by ₱500
    await payments.updateRemainingBalance(id, 850000);
    expect((await get(id)).remainingCentavos).toBe(850000);
    expect(await get(id)).toMatchObject({ startingBalanceCentavos: 1000000 }); // never overwritten

    const adjustment = (await payments.listPayments(id)).find((p) => p.kind === 'adjustment')!;
    expect(adjustment).toMatchObject({ amountCentavos: 50000, occurrenceDueDate: null });

    // Balance goes down via an adjustment, too
    await payments.updateRemainingBalance(id, 700000);
    expect((await get(id)).remainingCentavos).toBe(700000);

    await payments.deletePayment(adjustment.id);
    expect((await get(id)).remainingCentavos).toBe(650000); // 1,000,000 − 200,000 − 150,000
    expect((await get(id)).dueDate).toBe('2026-12-15'); // deleting an adjustment never moves due_date
  });

  it('is null when no balance is tracked', async () => {
    const id = await trackers.createTracker(input(), false);
    await pay(id);
    expect((await get(id)).remainingCentavos).toBeNull();
  });
});
