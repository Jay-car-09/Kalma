import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { TrackerInput } from '../trackers';

jest.mock('../db'); // src/data/__mocks__/db.ts — real SQL on Node's SQLite
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const { db } = require('../db');
const { migrate } = require('../migrations');
const { getLimits, LimitError } = require('../limits');
const repo = require('../trackers') as typeof import('../trackers');

const input = (overrides: Partial<TrackerInput> = {}): TrackerInput => ({
  direction: 'owe',
  name: 'BPI Card',
  amountCentavos: 245000,
  debtType: 'credit_card',
  dueDate: '2026-11-15',
  recurrence: { type: 'monthly', day: 15 },
  urgency: 'normal',
  notify: false,
  startingBalanceCentavos: null,
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

describe('getLimits', () => {
  it('Free is 10 trackers / 5 notified; Paid is unlimited', () => {
    expect(getLimits(false)).toEqual({ trackers: 10, notified: 5 });
    expect(getLimits(true)).toEqual({ trackers: Infinity, notified: Infinity });
  });
});

describe('tracker count (Free: 10)', () => {
  it('counts active, done and archived; only deleting frees a slot', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push(await repo.createTracker(input({ name: `T${i}` }), false));
    await repo.setArchived(ids[0], true);
    await db.runAsync(`UPDATE trackers SET status = 'done' WHERE id = ?`, [ids[1]]);

    expect((await repo.getUsage()).trackers).toBe(10);
    await expect(repo.createTracker(input(), false)).rejects.toBeInstanceOf(LimitError);
    await expect(repo.createTracker(input(), false)).rejects.toMatchObject({ kind: 'trackers' });

    await repo.deleteTracker(ids[0]);
    expect((await repo.getUsage()).trackers).toBe(9);
    await expect(repo.createTracker(input(), false)).resolves.toEqual(expect.any(String));
  });

  it('Pretend Paid lifts the limit', async () => {
    for (let i = 0; i < 11; i++) await repo.createTracker(input(), true);
    expect((await repo.getUsage()).trackers).toBe(11);
  });

  it('a refused create writes nothing', async () => {
    for (let i = 0; i < 10; i++) await repo.createTracker(input(), false);
    await expect(repo.createTracker(input({ name: 'Extra' }), false)).rejects.toThrow();
    expect(await repo.listTrackerNames()).not.toContain('Extra');
  });
});

describe('notified count (Free: 5)', () => {
  it('counts only active trackers with Notify on', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await repo.createTracker(input({ notify: true }), false));
    await repo.createTracker(input({ notify: false }), false);
    expect((await repo.getUsage()).notified).toBe(5);

    await expect(repo.createTracker(input({ notify: true }), false)).rejects.toMatchObject({
      kind: 'notified',
    });

    // Archiving turns Notify off, which frees a notify slot (not a tracker slot).
    await repo.setArchived(ids[0], true);
    expect(await repo.getUsage()).toEqual({ trackers: 6, notified: 4 });
    await expect(repo.createTracker(input({ notify: true }), false)).resolves.toEqual(
      expect.any(String),
    );
  });

  it('turning Notify on in an edit is checked; editing an already-notified tracker is not', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await repo.createTracker(input({ notify: true }), false));
    const quiet = await repo.createTracker(input({ notify: false }), false);

    await expect(repo.updateTracker(quiet, input({ notify: true }), false)).rejects.toMatchObject({
      kind: 'notified',
    });
    await expect(
      repo.updateTracker(ids[0], input({ notify: true, name: 'Renamed' }), false),
    ).resolves.toBeUndefined();
    await expect(repo.updateTracker(quiet, input({ notify: true }), true)).resolves.toBeUndefined();
    expect((await repo.getUsage()).notified).toBe(6);
  });
});
