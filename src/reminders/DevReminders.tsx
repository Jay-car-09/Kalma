import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SettingsSection } from '@/components/SettingsList';
import { listScheduledReminders } from '@/data/reminders';
import { formatDate, formatTime, fromLocalDate } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

import { notifications } from './notifications';
import { askReminderPermission } from './permission';
import { onRemindersSynced, sendTestReminder } from './sync';

// Development-only tools so the owner can check the engine on a real phone (docs/reminders.md).

export function TestReminderRow() {
  const { t } = useTranslation();
  async function onPress() {
    try {
      await askReminderPermission(t);
      if (!(await notifications()?.getPermissionsAsync())?.granted) {
        Alert.alert(t('settings.permissionOff'));
        return;
      }
      await sendTestReminder();
      Alert.alert(t('settings.testScheduled'));
    } catch (error) {
      console.warn('[reminders] test reminder failed', error);
      Alert.alert(t('settings.remindersUnavailable'));
    }
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText>{t('settings.testReminder')}</AppText>
    </Pressable>
  );
}

export function ScheduledRemindersSection() {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listScheduledReminders>>>([]);

  useEffect(() => {
    const load = () => listScheduledReminders().then(setRows);
    load();
    return onRemindersSynced(load);
  }, []);

  const when = (iso: string) => {
    const d = new Date(iso);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${formatDate(fromLocalDate(d), i18n.language)}, ${formatTime(time, i18n.language)}`;
  };

  return (
    <SettingsSection title={t('settings.scheduledReminders', { count: rows.length })}>
      {rows.length === 0 ? (
        <View style={styles.row}>
          <AppText tone="secondary">{t('settings.noScheduled')}</AppText>
        </View>
      ) : (
        rows.map((r) => (
          <View key={r.osNotificationId} style={styles.row}>
            <AppText numberOfLines={1}>{r.trackerName}</AppText>
            <AppText variant="caption" tone="secondary">
              {`${when(r.fireAt)} · ${t(`reminders.kind.${r.kind}`)}`}
            </AppText>
          </View>
        ))
      )}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pressed: { opacity: 0.6 },
});
