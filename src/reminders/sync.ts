import { Platform } from 'react-native';

import { listReminderTrackers, replaceScheduledNotifications, type ScheduledReminder } from '@/data/reminders';
import i18n from '@/i18n';

import { reminderMessages } from './messages';
import { notifications, reportRemindersHealth } from './notifications';
import { planReminders } from './plan';

// The only code that schedules on the phone (docs/reminders.md). Every sync throws away what's
// scheduled and rebuilds from fresh data: simple, always correct. It never blocks startup and
// never throws: failures are logged and shown as a calm notice in Settings.

const CHANNEL_ID = 'due-reminders';

export type SyncSettings = { reminderTime: string; showAmounts: boolean; isPaid: boolean };

let channelWarned = false;

/**
 * Android needs a channel before it shows the permission prompt (Android 13+). Best-effort:
 * Expo Go's per-project channel code throws a NullPointerException on some phones (seen on
 * Android 11 / Expo Go 58.0.5). Reminders still arrive then — Android falls back to the
 * library's default channel — so log once and carry on. Own builds (Phase 3) create it normally.
 */
export async function ensureChannel() {
  const api = notifications();
  if (!api || Platform.OS !== 'android') return;
  try {
    await api.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('reminders.channelName'),
      importance: api.AndroidImportance.DEFAULT,
    });
  } catch (error) {
    if (!channelWarned) console.warn('[reminders] could not create the "Due reminders" channel', error);
    channelWarned = true;
  }
}

async function syncReminders(settings: SyncSettings): Promise<void> {
  const api = notifications();
  if (!api) return; // already logged and reported

  // Cancel everything Kalma scheduled, except a pending dev test reminder.
  const pending = await api.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending.filter((n) => !n.content.data?.test).map((n) => api.cancelScheduledNotificationAsync(n.identifier)),
  );

  const scheduled: ScheduledReminder[] = [];
  if ((await api.getPermissionsAsync()).granted) {
    await ensureChannel();
    const trackers = await listReminderTrackers();
    const byId = new Map(trackers.map((t) => [t.id, t]));
    const plan = planReminders(trackers, new Date(), settings, settings.isPaid);
    const t = i18n.t.bind(i18n);

    for (const reminder of plan) {
      const tracker = byId.get(reminder.trackerId)!;
      // listReminderTrackers returns debt trackers; future modules look up their own module key.
      const { title, body } = reminderMessages.debt({ tracker, reminder, t, showAmounts: settings.showAmounts });
      const osNotificationId = await api.scheduleNotificationAsync({
        content: { title, body, data: { url: `/trackers/${tracker.id}` } },
        trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: new Date(reminder.fireAt), channelId: CHANNEL_ID },
      });
      scheduled.push({ osNotificationId, trackerId: tracker.id, fireAt: reminder.fireAt, kind: reminder.kind });
    }
  }
  await replaceScheduledNotifications(scheduled);
}

// Syncs run one at a time; requests that arrive mid-sync collapse into one more run.
let latest: SyncSettings | null = null;
let running = false;
let again = false;

/** Stores the current settings and resyncs. Called whenever a setting that affects reminders changes. */
export function configureReminders(settings: SyncSettings) {
  latest = settings;
  requestReminderSync();
}

/** Rebuilds all reminders with the latest settings. Fire-and-forget: never awaited, never throws. */
export function requestReminderSync() {
  if (!latest) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  (async () => {
    do {
      again = false;
      try {
        await syncReminders(latest!);
        if (notifications()) reportRemindersHealth(true);
      } catch (error) {
        // Retried on the next trigger (foreground, any change). The app carries on regardless.
        console.warn('[reminders] sync failed', error);
        reportRemindersHealth(false);
      }
      syncedListeners.forEach((listener) => listener());
    } while (again);
    running = false;
  })();
}

const syncedListeners = new Set<() => void>();

/** For the dev-only scheduled list: called after each sync attempt. */
export function onRemindersSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

/** Dev-only: one notification in 10 seconds, kept out of the normal rebuild. */
export async function sendTestReminder() {
  const api = notifications();
  if (!api) throw new Error('Notifications unavailable');
  await ensureChannel();
  await api.scheduleNotificationAsync({
    content: { title: i18n.t('reminders.testTitle'), body: i18n.t('reminders.testBody'), data: { test: true } },
    trigger: { type: api.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
  });
}
