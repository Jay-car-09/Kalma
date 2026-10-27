import { randomUUID } from 'expo-crypto';

import { today } from '@/lib/dates';
import { nextOccurrence } from '@/lib/recurrence';

import { db } from './db';
import { notifyChange } from './events';
import { getTracker } from './trackers';

// Payment history and the Mark Paid lifecycle (data-model §2.3, §5). Screens never write SQL.

export type PaymentKind = 'payment' | 'adjustment';

export type Payment = {
  id: string;
  trackerId: string;
  kind: PaymentKind;
  /** Payments: positive. Adjustments: positive = balance went up, negative = went down. */
  amountCentavos: number;
  paidOn: string;
  occurrenceDueDate: string | null;
  note: string | null;
};

export type PaymentInput = { amountCentavos: number; paidOn: string; note: string | null };

type Row = {
  id: string;
  tracker_id: string;
  kind: PaymentKind;
  amount_centavos: number;
  paid_on: string;
  occurrence_due_date: string | null;
  note: string | null;
};

const SELECT_PAYMENTS = `SELECT id, tracker_id, kind, amount_centavos, paid_on, occurrence_due_date, note
  FROM payments WHERE deleted_at IS NULL`;

function toPayment(row: Row): Payment {
  return {
    id: row.id,
    trackerId: row.tracker_id,
    kind: row.kind,
    amountCentavos: row.amount_centavos,
    paidOn: row.paid_on,
    occurrenceDueDate: row.occurrence_due_date,
    note: row.note,
  };
}

function assertPositive(amountCentavos: number) {
  if (!Number.isSafeInteger(amountCentavos) || amountCentavos <= 0) {
    throw new Error(`Payment amount must be a positive whole number of centavos: ${amountCentavos}`);
  }
}

/** Newest first. */
export async function listPayments(trackerId: string): Promise<Payment[]> {
  const rows = await db.getAllAsync<Row>(
    `${SELECT_PAYMENTS} AND tracker_id = ? ORDER BY paid_on DESC, created_at DESC`,
    [trackerId],
  );
  return rows.map(toPayment);
}

export async function getPayment(id: string): Promise<Payment | null> {
  const row = await db.getFirstAsync<Row>(`${SELECT_PAYMENTS} AND id = ?`, [id]);
  return row ? toPayment(row) : null;
}

/**
 * Mark Paid / Received (data-model §5.1–5.2): settles the current due date — always the
 * oldest unpaid one — then advances it, or marks the tracker Done. Returns the payment id.
 */
export async function markPaid(trackerId: string, input: PaymentInput): Promise<string> {
  assertPositive(input.amountCentavos);
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    const tracker = await getTracker(trackerId, tx);
    if (!tracker || tracker.status !== 'active') throw new Error(`Tracker ${trackerId} is not active`);

    await tx.runAsync(
      `INSERT INTO payments (id, tracker_id, kind, amount_centavos, paid_on, occurrence_due_date,
         note, user_id, created_at, updated_at)
       VALUES (?, ?, 'payment', ?, ?, ?, ?, NULL, ?, ?)`,
      [id, trackerId, input.amountCentavos, input.paidOn, tracker.dueDate, input.note, now, now],
    );

    const next = nextOccurrence(tracker.recurrence, tracker.dueDate);
    const after = await getTracker(trackerId, tx); // remaining balance now includes this payment
    const paidOff = after?.remainingCentavos != null && after.remainingCentavos <= 0;
    const done = next === null || paidOff;

    await tx.runAsync(
      `UPDATE trackers SET due_date = ?, status = ?, notify = ?, updated_at = ?, needs_push = 1 WHERE id = ?`,
      [next ?? tracker.dueDate, done ? 'done' : 'active', done ? 0 : tracker.notify ? 1 : 0, now, trackerId],
    );
  });
  notifyChange();
  return id;
}

/** Edits amount, date paid and note. The occurrence it settles never changes. */
export async function updatePayment(id: string, input: PaymentInput): Promise<void> {
  assertPositive(input.amountCentavos);
  await db.runAsync(
    `UPDATE payments SET amount_centavos = ?, paid_on = ?, note = ?, updated_at = ?, needs_push = 1
     WHERE id = ? AND kind = 'payment' AND deleted_at IS NULL`,
    [input.amountCentavos, input.paidOn, input.note, new Date().toISOString(), id],
  );
  notifyChange();
}

/**
 * Soft-deletes a payment or adjustment (data-model §5.3). If it was the latest payment, the
 * tracker's due date moves back to the occurrence it settled, and Done becomes Active again.
 * Undo after Mark Paid is this same call.
 */
export async function deletePayment(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const payment = await tx.getFirstAsync<Row>(`${SELECT_PAYMENTS} AND id = ?`, [id]);
    if (!payment) return;

    const latest = await tx.getFirstAsync<{ id: string }>(
      `SELECT id FROM payments
       WHERE tracker_id = ? AND kind = 'payment' AND deleted_at IS NULL
       ORDER BY occurrence_due_date DESC, created_at DESC LIMIT 1`,
      [payment.tracker_id],
    );

    await tx.runAsync(`UPDATE payments SET deleted_at = ?, updated_at = ?, needs_push = 1 WHERE id = ?`, [now, now, id]);

    if (payment.kind === 'payment' && latest?.id === id && payment.occurrence_due_date) {
      await tx.runAsync(
        `UPDATE trackers SET due_date = ?,
           status = CASE WHEN status = 'done' THEN 'active' ELSE status END,
           updated_at = ?, needs_push = 1
         WHERE id = ? AND deleted_at IS NULL`,
        [payment.occurrence_due_date, now, payment.tracker_id],
      );
    }
  });
  notifyChange();
}

/**
 * "Update remaining balance": saves the difference as an adjustment, so starting_balance
 * is never overwritten and history stays intact (data-model §2.3, §4).
 */
export async function updateRemainingBalance(trackerId: string, newBalanceCentavos: number): Promise<void> {
  if (!Number.isSafeInteger(newBalanceCentavos) || newBalanceCentavos < 0) {
    throw new Error(`Balance must be zero or more centavos: ${newBalanceCentavos}`);
  }
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const tracker = await getTracker(trackerId, tx);
    if (tracker?.remainingCentavos == null) throw new Error(`Tracker ${trackerId} has no tracked balance`);

    const difference = newBalanceCentavos - tracker.remainingCentavos;
    if (difference === 0) return;
    await tx.runAsync(
      `INSERT INTO payments (id, tracker_id, kind, amount_centavos, paid_on, occurrence_due_date,
         note, user_id, created_at, updated_at)
       VALUES (?, ?, 'adjustment', ?, ?, NULL, NULL, NULL, ?, ?)`,
      [randomUUID(), trackerId, difference, today(), now, now],
    );
  });
  notifyChange();
}
