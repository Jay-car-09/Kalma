import { db } from './db';
import type { PaymentKind } from './payments';
import { listTrackers, type Tracker } from './trackers';

// Reads for CSV export. Soft-deleted rows are left out (data-model §1.5).

/** Every tracker the user still has: active, done and archived. */
export async function listTrackersForExport(): Promise<Tracker[]> {
  const lists = await Promise.all(
    (['active', 'done', 'archived'] as const).map((status) => listTrackers({ direction: 'all', status })),
  );
  return lists.flat();
}

export type ExportPayment = {
  trackerName: string;
  kind: PaymentKind;
  amountCentavos: number;
  paidOn: string;
  occurrenceDueDate: string | null;
  note: string | null;
};

/** Payments and adjustments, oldest first. */
export async function listPaymentsForExport(): Promise<ExportPayment[]> {
  return db.getAllAsync<ExportPayment>(
    `SELECT t.name AS trackerName, p.kind, p.amount_centavos AS amountCentavos, p.paid_on AS paidOn,
       p.occurrence_due_date AS occurrenceDueDate, p.note
     FROM payments p JOIN trackers t ON t.id = p.tracker_id
     WHERE p.deleted_at IS NULL AND t.deleted_at IS NULL
     ORDER BY p.paid_on, p.created_at`,
  );
}
