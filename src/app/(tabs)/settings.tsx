import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { OptionRow, SettingsSection, SwitchRow } from '@/components/SettingsList';
import { formatTime } from '@/lib/dates';
import { ScheduledRemindersSection, TestReminderRow } from '@/reminders/DevReminders';
import { useNotificationPermission } from '@/reminders/permission';
import {
  useSettings,
  type LanguagePreference,
  type ThemePreference,
} from '@/settings/SettingsProvider';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGE_OPTIONS: LanguagePreference[] = ['system', 'en', 'tl'];

const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const settings = useSettings();
  const { theme, setTheme, language, setLanguage, pretendPaid, setPretendPaid } = settings;
  const { reminderTime, setReminderTime, showAmounts, setShowAmounts } = settings;
  const permission = useNotificationPermission();
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [hour, minute] = reminderTime.split(':').map(Number);

  return (
    <Screen title={t('settings.title')}>
      <SettingsSection title={t('settings.reminders')}>
        {permission === 'denied' && (
          <View style={styles.notice}>
            <AppText tone="secondary">{t('settings.permissionOff')}</AppText>
            <Button small variant="secondary" label={t('settings.openSettings')} onPress={() => Linking.openSettings()} />
          </View>
        )}
        <Pressable
          onPress={() => setTimePickerOpen((open) => !open)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <AppText style={styles.grow}>{t('settings.reminderTime')}</AppText>
          <AppText tone="secondary">{formatTime(reminderTime, i18n.language)}</AppText>
        </Pressable>
        {timePickerOpen && (
          <DateTimePicker
            value={new Date(2000, 0, 1, hour, minute)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={scheme}
            textColor={colors.textPrimary}
            onValueChange={(_, date) => {
              setReminderTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
              if (Platform.OS === 'android') setTimePickerOpen(false);
            }}
            onDismiss={() => setTimePickerOpen(false)}
          />
        )}
        <SwitchRow
          label={t('settings.showAmounts')}
          hint={t('settings.showAmountsHint')}
          value={showAmounts}
          onValueChange={setShowAmounts}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.appearance')}>
        {THEME_OPTIONS.map((option) => (
          <OptionRow
            key={option}
            label={t(`settings.theme.${option}`)}
            selected={theme === option}
            onPress={() => setTheme(option)}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={t('settings.language')}>
        {LANGUAGE_OPTIONS.map((option) => (
          <OptionRow
            key={option}
            label={t(`settings.languageOption.${option}`)}
            selected={language === option}
            onPress={() => setLanguage(option)}
          />
        ))}
      </SettingsSection>

      {__DEV__ && (
        <SettingsSection title={t('settings.developer')}>
          <SwitchRow
            label={t('settings.pretendPaid')}
            hint={t('settings.pretendPaidHint')}
            value={pretendPaid}
            onValueChange={setPretendPaid}
          />
          <View style={styles.previewRow}>
            <AppText tone="secondary">{t('settings.amountPreview')}</AppText>
            <Amount centavos={245000} variant="heading" />
          </View>
          <TestReminderRow />
        </SettingsSection>
      )}
      {__DEV__ && <ScheduledRemindersSection />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
  notice: { gap: spacing.md, padding: spacing.lg, alignItems: 'flex-start' },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
