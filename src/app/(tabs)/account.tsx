import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { ActionRow, SettingsSection } from '@/components/SettingsList';
import { listPaymentsForExport, listTrackersForExport } from '@/data/export';
import { paymentsCsv, trackersCsv } from '@/export/buildCsv';
import { shareCsv } from '@/export/share';
import { today } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

type ExportKind = 'trackers' | 'payments';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<ExportKind | null>(null);

  async function exportCsv(kind: ExportKind) {
    setBusy(kind);
    try {
      const content =
        kind === 'trackers'
          ? trackersCsv(await listTrackersForExport(), t, i18n.language)
          : paymentsCsv(await listPaymentsForExport(), t);
      await shareCsv(`kalma-${kind}-${today()}.csv`, content, t('export.shareTitle'));
    } catch (error) {
      console.warn('[export] failed', error);
      Alert.alert(t('export.failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen title={t('account.title')}>
      <AppText tone="secondary">{t('account.empty')}</AppText>

      <View style={styles.section}>
        <SettingsSection title={t('export.title')}>
          <ActionRow
            label={t('export.trackers')}
            icon="share-outline"
            disabled={busy !== null}
            onPress={() => exportCsv('trackers')}
          />
          <ActionRow
            label={t('export.payments')}
            icon="share-outline"
            disabled={busy !== null}
            onPress={() => exportCsv('payments')}
          />
        </SettingsSection>
        <AppText variant="caption" tone="tertiary" style={styles.hint}>
          {t('export.hint')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  hint: { paddingHorizontal: spacing.xs },
});
