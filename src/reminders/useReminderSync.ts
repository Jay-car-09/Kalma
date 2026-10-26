import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { onChange } from '@/data/events';
import { useSettings } from '@/settings/SettingsProvider';
import { useIsPaid } from '@/settings/tier';

import { configureReminders, requestReminderSync } from './sync';

/**
 * Wires every sync trigger from docs/reminders.md: app start, foreground, any tracker or payment
 * change (incl. Mark Paid/Undo), reminder time, show-amounts, language and isPaid changes.
 * Also opens a tracker when its notification is tapped. Mount once, after the app is ready.
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
    if (!ready) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      Notifications.clearLastNotificationResponse();
      router.push(url as never);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready, router]);
}
