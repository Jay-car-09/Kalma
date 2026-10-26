import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { OptionRow, SettingsSection, SwitchRow } from '@/components/SettingsList';
import {
  useSettings,
  type LanguagePreference,
  type ThemePreference,
} from '@/settings/SettingsProvider';
import { spacing } from '@/theme/tokens';

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGE_OPTIONS: LanguagePreference[] = ['system', 'en', 'tl'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage, pretendPaid, setPretendPaid } = useSettings();

  return (
    <Screen title={t('settings.title')}>
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
        </SettingsSection>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
