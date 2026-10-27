import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { TrackerInput } from '../trackers';

jest.mock('../db'); // src/data/__mocks__/db.ts — real SQL on Node's SQLite
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const { db } = require('../db');
const { migrate } = require('../migrations');
const trackers = require('../trackers') as typeof import('../trackers');
const payments = require('../payments') as typeof import('../payments');

const input = (overrides: Partial<TrackerInput> = {}): TrackerInput => ({
  direction: 'owe',
  name: 'BPI Card',
  amountCentavos: 245050,
  debtType: 'credit_card',
  dueDate: '2026-11-15',
  recurrence: { type: 'monthly', day: 15 },
  urgency: 'normal',
  notify: true,
  startingBalanceCentavos: 1000000,
  interestRate: null,
  interestPeriod: null,
  statementCutoffDay: null,
  notes: null,
  ...overrides,
});
const paid = { amountCentavos: 245050, paidOn: '2026-11-14', note: null };

/** Pretend everything was just synced. */
async function markAllPushed() {
  for (const table of ['trackers', 'debt_details', 'payments']) await db.runAsync(`UPDATE ${table} SET needs_push = 0`);
}

/** Rows waiting to be pushed, as "table:id". */
async function waiting(): Promise<string[]> {
  const rows = await db.getAllAsync(
    `SELECT 'trackers:' || id AS row FROM trackers WHERE needs_push = 1
     UNION ALL SELECT 'debt_details:' || tracker_id FROM debt_details WHERE needs_push = 1
     UNION ALL SELECT 'payments:' || id FROM payments WHERE needs_push = 1`,
  );
  return rows.map((r: { row: string }) => r.row).sort();
}

let id: string;

beforeEach(async () => {
  db.reset();
  await migrate(db);
  id = await trackers.createTracker(input(), true);
  await markAllPushed();
});

describe('every local write marks its rows for the next sync (needs_push = 1)', () => {
  it('sync_state starts with nothing pulled yet', async () => {
    expect(await db.getAllAsync('SELECT * FROM sync_state')).toEqual([{ id: 1, last_pulled_at: null }]);
  });

  it('createTracker: tracker and details', async () => {
    const other = await trackers.createTracker(input({ name: 'GCash loan' }), true);
    expect(await waiting()).toEqual([`debt_details:${other}`, `trackers:${other}`]);
  });

  it('updateTracker: tracker and details', async () => {
    await trackers.updateTracker(id, input({ name: 'BPI Gold' }), true);
    expect(await waiting()).toEqual([`debt_details:${id}`, `trackers:${id}`]);
  });

  it('setArchived: archive and unarchive', async () => {
    await trackers.setArchived(id, true);
    expect(await waiting()).toEqual([`trackers:${id}`]);
    await markAllPushed();
    await trackers.setArchived(id, false);
    expect(await waiting()).toEqual([`trackers:${id}`]);
  });

  it('deleteTracker: tracker, details and its payments', async () => {
    const p = await payments.markPaid(id, paid);
    await markAllPushed();
    await trackers.deleteTracker(id);
    expect(await waiting()).toEqual([`debt_details:${id}`, `payments:${p}`, `trackers:${id}`].sort());
  });

  it('markPaid: the payment and the tracker it advanced', async () => {
    const p = await payments.markPaid(id, paid);
    expect(await waiting()).toEqual([`payments:${p}`, `trackers:${id}`].sort());
  });

  it('updatePayment', async () => {
    const p = await payments.markPaid(id, paid);
    await markAllPushed();
    await payments.updatePayment(p, { ...paid, note: 'GCash' });
    expect(await waiting()).toEqual([`payments:${p}`]);
  });

  it('deletePayment (also Undo): the payment and the tracker it moved back', async () => {
    const p = await payments.markPaid(id, paid);
    await markAllPushed();
    await payments.deletePayment(p);
    expect(await waiting()).toEqual([`payments:${p}`, `trackers:${id}`].sort());
  });

  it('updateRemainingBalance: the adjustment', async () => {
    await payments.updateRemainingBalance(id, 500000);
    const [row] = await waiting();
    expect(row).toMatch(/^payments:/);
    expect(await waiting()).toHaveLength(1);
  });

  it('no UPDATE of a synced table in the data layer forgets needs_push', () => {
    const fs = require('node:fs');
    const dir = 'src/data'; // jest runs from the project root
    for (const file of (fs.readdirSync(dir) as string[]).filter((f) => f.endsWith('.ts'))) {
      const source: string = fs.readFileSync(`${dir}/${file}`, 'utf8');
      for (const [statement] of source.matchAll(/UPDATE (trackers|debt_details|payments) SET[^`]*/g)) {
        expect({ file, statement, hasNeedsPush: /needs_push =/.test(statement) }).toMatchObject({ hasNeedsPush: true });
      }
    }
  });
});
