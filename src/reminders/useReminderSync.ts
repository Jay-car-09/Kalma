import type { NotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { onChange } from '@/data/events';
import { useSettings } from '@/settings/SettingsProvider';
import { useIsPaid } from '@/settings/tier';

import { notifications } from './notifications';
import { configureReminders, requestReminderSync } from './sync';

/**
 * Wires every sync trigger from docs/reminders.md: app start, foreground, any tracker or payment
 * change (incl. Mark Paid/Undo), reminder time, show-amounts, language and isPaid changes.
 * Also opens a tracker when its notification is tapped. Mount once, after the app is ready.
 * Nothing here can stop the app loading: syncs are fire-and-forget and failures are caught.
 */
export function useReminderSync(ready: boolean) {
  const { reminderTime, showAmounts } = useSettings();
  const isPaid = useIsPaid();
  const { i18n } = useTranslation();
  const router = useRouter();

  // App start + any setting that changes what's scheduled or how it reads.
  useEffect(() => {
    if (ready) configureReminders({ reminderTime, showAmounts, isPaid });
  }, [ready, reminderTime, showAmounts, isPaid, i18n.language]);

  useEffect(() => {
    if (!ready) return;
    const offData = onChange(requestReminderSync);
    const foreground = AppState.addEventListener('change', (state) => state === 'active' && requestReminderSync());
    return () => {
      offData();
      foreground.remove();
    };
  }, [ready]);

  // Tapping a reminder opens its tracker (also when the tap launched the app).
  useEffect(() => {
    const api = ready ? notifications() : null;
    if (!api) return;
    const open = (response: NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      api.clearLastNotificationResponse();
      router.push(url as never);
    };
    try {
      open(api.getLastNotificationResponse());
      const sub = api.addNotificationResponseReceivedListener((response) => {
        try {
          open(response);
        } catch (error) {
          console.warn('[reminders] could not open tapped reminder', error);
        }
      });
      return () => sub.remove();
    } catch (error) {
      console.warn('[reminders] tap handling unavailable', error);
    }
  }, [ready, router]);
}
