import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { today } from '@/lib/dates';

import type { TrackerInput } from '../trackers';

jest.mock('../db'); // src/data/__mocks__/db.ts — real SQL on Node's SQLite
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const { db } = require('../db');
const { migrate } = require('../migrations');
const trackers = require('../trackers') as typeof import('../trackers');
const payments = require('../payments') as typeof import('../payments');
const { loadDashboard } = require('../dashboard') as typeof import('../dashboard');

const input = (overrides: Partial<TrackerInput> = {}): TrackerInput => ({
  direction: 'owe',
  name: 'Atome',
  amountCentavos: 100000,
  debtType: 'bnpl',
  dueDate: today(),
  recurrence: { type: 'none' },
  urgency: 'normal',
  notify: false,
  startingBalanceCentavos: 500000,
  interestRate: null,
  interestPeriod: null,
  statementCutoffDay: null,
  notes: null,
  ...overrides,
});

beforeEach(async () => {
  db.reset();
  await migrate(db);
});

describe('loadDashboard', () => {
  it('reports no trackers on a fresh install', async () => {
    expect((await loadDashboard()).hasTrackers).toBe(false);
  });

  it('excludes archived trackers everywhere, keeps Done in history, ignores adjustments', async () => {
    const done = await trackers.createTracker(input(), false);
    await payments.markPaid(done, { amountCentavos: 100000, paidOn: today(), note: null });
    await payments.updateRemainingBalance(done, 450000); // an adjustment, not a payment

    const archived = await trackers.createTracker(input({ name: 'Old loan', urgency: 'high' }), false);
    await payments.markPaid(archived, { amountCentavos: 70000, paidOn: today(), note: null });
    await trackers.setArchived(archived, true);

    const { dashboard, hasTrackers } = await loadDashboard();
    expect(hasTrackers).toBe(true);
    expect(dashboard.paymentsByMonth.at(-1)?.total).toBe(100000); // archived payment left out
    expect(dashboard.onTime).toEqual({ onTime: 1, total: 1 });
    expect(dashboard.byUrgency).toEqual({ low: 0, normal: 0, high: 0 }); // Done and archived aren't active
    expect(dashboard.totalDebt).toBeNull();
  });
});
