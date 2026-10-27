import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Recurrence } from '@/lib/recurrence';

import { db } from './db';
import { notifyChange } from './events';
import { getLimits, LimitError } from './limits';

// All tracker reads and writes. Screens call these; they never write SQL (data-model §1.7).

export type Direction = 'owe' | 'owed_to_me';
export type DebtType =
  | 'credit_card'
  | 'personal_loan'
  | 'bnpl'
  | 'online_lending'
  | 'sss_loan'
  | 'pagibig_loan'
  | 'informal'
  | 'other';
export type Urgency = 'low' | 'normal' | 'high';
export type TrackerStatus = 'active' | 'done' | 'archived';
export type InterestPeriod = 'monthly' | 'annual';

export const DEBT_TYPES: DebtType[] = [
  'credit_card',
  'personal_loan',
  'bnpl',
  'online_lending',
  'sss_loan',
  'pagibig_loan',
  'informal',
  'other',
];

export type TrackerInput = {
  direction: Direction;
  name: string;
  amountCentavos: number;
  debtType: DebtType;
  dueDate: string;
  recurrence: Recurrence;
  urgency: Urgency;
  notify: boolean;
  startingBalanceCentavos: number | null;
  interestRate: number | null;
  interestPeriod: InterestPeriod | null;
  statementCutoffDay: number | null;
  notes: string | null;
};

export type Tracker = TrackerInput & {
  id: string;
  status: TrackerStatus;
  /** Null when the user isn't tracking a balance (data-model §4). */
  remainingCentavos: number | null;
  /** ISO timestamp. */
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  amount_centavos: number;
  due_date: string;
  recurrence: string;
  urgency: Urgency;
  notify: number;
  status: TrackerStatus;
  notes: string | null;
  direction: Direction;
  debt_type: DebtType;
  starting_balance_centavos: number | null;
  interest_rate: number | null;
  interest_period: InterestPeriod | null;
  statement_cutoff_day: number | null;
  remaining_centavos: number | null;
  created_at: string;
};

// Remaining balance = starting − Σ payments + Σ adjustments (data-model §4).
const SELECT_TRACKERS = `
  SELECT t.id, t.name, t.amount_centavos, t.due_date, t.recurrence, t.urgency, t.notify,
    t.status, t.notes, t.created_at, d.direction, d.debt_type, d.starting_balance_centavos,
    d.interest_rate, d.interest_period, d.statement_cutoff_day,
    d.starting_balance_centavos - COALESCE((
      SELECT SUM(CASE WHEN p.kind = 'payment' THEN p.amount_centavos ELSE -p.amount_centavos END)
      FROM payments p WHERE p.tracker_id = t.id AND p.deleted_at IS NULL
    ), 0) AS remaining_centavos
  FROM trackers t
  JOIN debt_details d ON d.tracker_id = t.id
  WHERE t.deleted_at IS NULL AND d.deleted_at IS NULL AND t.module = 'debt'`;

function toTracker(row: Row): Tracker {
  return {
    id: row.id,
    direction: row.direction,
    name: row.name,
    amountCentavos: row.amount_centavos,
    debtType: row.debt_type,
    dueDate: row.due_date,
    recurrence: JSON.parse(row.recurrence),
    urgency: row.urgency,
    notify: row.notify === 1,
    status: row.status,
    startingBalanceCentavos: row.starting_balance_centavos,
    interestRate: row.interest_rate,
    interestPeriod: row.interest_period,
    statementCutoffDay: row.statement_cutoff_day,
    notes: row.notes,
    remainingCentavos: row.remaining_centavos,
    createdAt: row.created_at,
  };
}

export async function listTrackers(filter: {
  direction: Direction | 'all';
  status: TrackerStatus;
}): Promise<Tracker[]> {
  const rows = await db.getAllAsync<Row>(
    `${SELECT_TRACKERS} AND t.status = ? AND (? = 'all' OR d.direction = ?)
     ORDER BY t.due_date, t.name COLLATE NOCASE`,
    [filter.status, filter.direction, filter.direction],
  );
  return rows.map(toTracker);
}

export async function getTracker(id: string, executor: SQLiteDatabase = db): Promise<Tracker | null> {
  const row = await executor.getFirstAsync<Row>(`${SELECT_TRACKERS} AND t.id = ?`, [id]);
  return row ? toTracker(row) : null;
}

/** Names typed before, for autocomplete (data-model §2.6). */
export async function listTrackerNames(): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT DISTINCT name FROM trackers WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
  );
  return rows.map((r) => r.name);
}

/** The two counts the Free limits are measured against (data-model §6). Every module counts. */
export async function getUsage(executor: SQLiteDatabase = db) {
  const row = await executor.getFirstAsync<{ trackers: number; notified: number }>(
    `SELECT COUNT(*) AS trackers,
       COALESCE(SUM(status = 'active' AND notify = 1), 0) AS notified
     FROM trackers WHERE deleted_at IS NULL`,
  );
  return { trackers: row?.trackers ?? 0, notified: row?.notified ?? 0 };
}

function detailValues(input: TrackerInput) {
  return [
    input.direction,
    input.debtType,
    input.startingBalanceCentavos,
    input.interestRate,
    input.interestRate == null ? null : input.interestPeriod,
    input.debtType === 'credit_card' ? input.statementCutoffDay : null,
  ];
}

/** Creates a tracker. Throws LimitError when Free is full (or full on notified trackers). */
export async function createTracker(input: TrackerInput, isPaid: boolean): Promise<string> {
  const limits = getLimits(isPaid);
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    const usage = await getUsage(tx);
    if (usage.trackers >= limits.trackers) throw new LimitError('trackers');
    if (input.notify && usage.notified >= limits.notified) throw new LimitError('notified');

    await tx.runAsync(
      `INSERT INTO trackers (id, module, name, amount_centavos, currency, due_date, recurrence,
         urgency, notify, status, notes, user_id, created_at, updated_at)
       VALUES (?, 'debt', ?, ?, 'PHP', ?, ?, ?, ?, 'active', ?, NULL, ?, ?)`,
      [
        id,
        input.name,
        input.amountCentavos,
        input.dueDate,
        JSON.stringify(input.recurrence),
        input.urgency,
        input.notify ? 1 : 0,
        input.notes,
        now,
        now,
      ],
    );
    await tx.runAsync(
      `INSERT INTO debt_details (tracker_id, direction, debt_type, starting_balance_centavos,
         interest_rate, interest_period, statement_cutoff_day, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, ...detailValues(input), now, now],
    );
  });
  notifyChange();
  return id;
}

/** Saves edits. Throws LimitError if this turns Notify on while Free is at its notified cap. */
export async function updateTracker(id: string, input: TrackerInput, isPaid: boolean): Promise<void> {
  const limits = getLimits(isPaid);
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ status: TrackerStatus; notify: number }>(
      `SELECT status, notify FROM trackers WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!current) throw new Error(`Tracker ${id} not found`);

    // Only active trackers can notify (archived/done are always off).
    const notify = current.status === 'active' && input.notify;
    const alreadyCounted = current.status === 'active' && current.notify === 1;
    if (notify && !alreadyCounted && (await getUsage(tx)).notified >= limits.notified) {
      throw new LimitError('notified');
    }

    await tx.runAsync(
      `UPDATE trackers SET name = ?, amount_centavos = ?, due_date = ?, recurrence = ?,
         urgency = ?, notify = ?, notes = ?, updated_at = ?, needs_push = 1
       WHERE id = ?`,
      [
        input.name,
        input.amountCentavos,
        input.dueDate,
        JSON.stringify(input.recurrence),
        input.urgency,
        notify ? 1 : 0,
        input.notes,
        now,
        id,
      ],
    );
    await tx.runAsync(
      `UPDATE debt_details SET direction = ?, debt_type = ?, starting_balance_centavos = ?,
         interest_rate = ?, interest_period = ?, statement_cutoff_day = ?, updated_at = ?, needs_push = 1
       WHERE tracker_id = ?`,
      [...detailValues(input), now, id],
    );
  });
  notifyChange();
}

/** Archive turns reminders off; it does not free a Free slot (CLAUDE.md §5). */
export async function setArchived(id: string, archived: boolean): Promise<void> {
  await db.runAsync(
    `UPDATE trackers SET status = ?, notify = 0, updated_at = ?, needs_push = 1 WHERE id = ? AND deleted_at IS NULL`,
    [archived ? 'archived' : 'active', new Date().toISOString(), id],
  );
  notifyChange();
}

/** Soft-deletes the tracker, its details and its payment history together (data-model §5.5). */
export async function deleteTracker(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const sql of [
      `UPDATE trackers SET deleted_at = ?, updated_at = ?, needs_push = 1 WHERE id = ? AND deleted_at IS NULL`,
      `UPDATE debt_details SET deleted_at = ?, updated_at = ?, needs_push = 1 WHERE tracker_id = ? AND deleted_at IS NULL`,
      `UPDATE payments SET deleted_at = ?, updated_at = ?, needs_push = 1 WHERE tracker_id = ? AND deleted_at IS NULL`,
    ]) {
      await tx.runAsync(sql, [now, now, id]);
    }
  });
  notifyChange();
}
