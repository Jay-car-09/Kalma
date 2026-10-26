import type { ReminderKind } from '@/reminders/plan';

import { db } from './db';
import { listTrackers, type Tracker } from './trackers';

// Reminders-engine bookkeeping (data-model §2.4). Device-local, never synced.
// No notifyChange() here: these writes follow a sync and must not trigger another one.

/** Active trackers with Notify on — what the planner works from. */
export async function listReminderTrackers(): Promise<Tracker[]> {
  return (await listTrackers({ direction: 'all', status: 'active' })).filter((t) => t.notify);
}

export type ScheduledReminder = { osNotificationId: string; trackerId: string; fireAt: string; kind: ReminderKind };

/** Replaces every row with what the phone now has scheduled. */
export async function replaceScheduledNotifications(rows: ScheduledReminder[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM scheduled_notifications');
    for (const r of rows) {
      await tx.runAsync(
        'INSERT INTO scheduled_notifications (os_notification_id, tracker_id, fire_at, kind) VALUES (?, ?, ?, ?)',
        [r.osNotificationId, r.trackerId, r.fireAt, r.kind],
      );
    }
  });
}

/** For the dev-only "Scheduled reminders" list. */
export async function listScheduledReminders(): Promise<(ScheduledReminder & { trackerName: string })[]> {
  return db.getAllAsync(
    `SELECT s.os_notification_id AS osNotificationId, s.tracker_id AS trackerId, s.fire_at AS fireAt,
       s.kind, COALESCE(t.name, '') AS trackerName
     FROM scheduled_notifications s LEFT JOIN trackers t ON t.id = s.tracker_id
     ORDER BY s.fire_at`,
  );
}
