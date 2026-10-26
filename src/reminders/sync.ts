import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { listReminderTrackers, replaceScheduledNotifications, type ScheduledReminder } from '@/data/reminders';
import i18n from '@/i18n';

import { reminderMessages } from './messages';
import { planReminders } from './plan';

// The ONLY code that talks to the phone's notification system (docs/reminders.md).
// Every sync throws away what's scheduled and rebuilds from fresh data: simple, always correct.

const CHANNEL_ID = 'due-reminders';

export type SyncSettings = { reminderTime: string; showAmounts: boolean; isPaid: boolean };

// While the app is open, show reminders as a quiet banner (no sound).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('reminders.channelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function syncReminders(settings: SyncSettings): Promise<void> {
  // Cancel everything Kalma scheduled, except a pending dev test reminder.
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => !n.content.data?.test)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const scheduled: ScheduledReminder[] = [];
  if ((await Notifications.getPermissionsAsync()).granted) {
    await ensureChannel();
    const trackers = await listReminderTrackers();
    const byId = new Map(trackers.map((t) => [t.id, t]));
    const plan = planReminders(trackers, new Date(), settings, settings.isPaid);
    const t = i18n.t.bind(i18n);

    for (const reminder of plan) {
      const tracker = byId.get(reminder.trackerId)!;
      // listReminderTrackers returns debt trackers; future modules look up their own module key.
      const { title, body } = reminderMessages.debt({ tracker, reminder, t, showAmounts: settings.showAmounts });
      const osNotificationId = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { url: `/trackers/${tracker.id}` } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.fireAt),
          channelId: CHANNEL_ID,
        },
      });
      scheduled.push({ osNotificationId, trackerId: tracker.id, fireAt: reminder.fireAt, kind: reminder.kind });
    }
  }
  await replaceScheduledNotifications(scheduled);
  syncedListeners.forEach((listener) => listener());
}

// Syncs run one at a time; requests that arrive mid-sync collapse into one more run.
let latest: SyncSettings | null = null;
let running: Promise<void> | null = null;
let again = false;

/** Stores the current settings and resyncs. Called whenever a setting that affects reminders changes. */
export function configureReminders(settings: SyncSettings) {
  latest = settings;
  requestReminderSync();
}

/** Rebuilds all reminders with the latest settings (after data changes, on foreground, …). */
export function requestReminderSync() {
  if (!latest) return;
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncReminders(latest!);
      } while (again);
    } catch (error) {
      // A failed sync is retried on the next trigger; reminders are never half-recorded.
      console.warn('[reminders] sync failed', error);
    } finally {
      running = null;
    }
  })();
}

const syncedListeners = new Set<() => void>();

/** For the dev-only scheduled list: called after each sync finishes. */
export function onRemindersSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

/** Dev-only: one notification in 10 seconds, kept out of the normal rebuild. */
export async function sendTestReminder() {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: i18n.t('reminders.testTitle'), body: i18n.t('reminders.testBody'), data: { test: true } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
  });
}
