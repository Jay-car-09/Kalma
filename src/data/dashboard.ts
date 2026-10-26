import { computeDashboard, type Dashboard, type DashboardPayment } from '@/lib/dashboard';
import { today } from '@/lib/dates';

import { db } from './db';
import { getUsage, listTrackers } from './trackers';

/** Everything the Home dashboard shows. Archived and deleted trackers are excluded everywhere. */
export async function loadDashboard(): Promise<{ dashboard: Dashboard; hasTrackers: boolean }> {
  const [active, done, payments, usage] = await Promise.all([
    listTrackers({ direction: 'all', status: 'active' }),
    listTrackers({ direction: 'all', status: 'done' }),
    db.getAllAsync<DashboardPayment>(
      `SELECT p.tracker_id AS trackerId, d.direction, d.debt_type AS debtType,
         p.amount_centavos AS amountCentavos, p.paid_on AS paidOn,
         p.occurrence_due_date AS occurrenceDueDate
       FROM payments p
       JOIN trackers t ON t.id = p.tracker_id
       JOIN debt_details d ON d.tracker_id = t.id
       WHERE p.kind = 'payment' AND p.deleted_at IS NULL
         AND t.deleted_at IS NULL AND t.status != 'archived'`,
    ),
    getUsage(),
  ]);
  return { dashboard: computeDashboard([...active, ...done], payments, today()), hasTrackers: usage.trackers > 0 };
}
