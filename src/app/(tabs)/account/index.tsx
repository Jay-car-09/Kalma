import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { useSession } from '@/cloud/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ActionRow, InfoRow, SettingsSection } from '@/components/SettingsList';
import { listPaymentsForExport, listTrackersForExport } from '@/data/export';
import { paymentsCsv, trackersCsv } from '@/export/buildCsv';
import { shareCsv } from '@/export/share';
import { today } from '@/lib/dates';
import { useIsPaid } from '@/settings/tier';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type ExportKind = 'trackers' | 'payments';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { loading, user } = useSession();
  const isPaid = useIsPaid();
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
      {loading ? null : user ? (
        <SettingsSection title={t('account.yourAccount')}>
          <InfoRow label={t('account.email')} value={user.email ?? ''} />
          <InfoRow label={t('account.status')} value={t('account.signedIn')} />
          <InfoRow label={t('account.plan')} value={isPaid ? t('account.paid') : t('account.free')} />
        </SettingsSection>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="heading">{t('account.backupTitle')}</AppText>
          <AppText tone="secondary">{t('account.backupBody')}</AppText>
          <Button label={t('account.signInButton')} onPress={() => router.push('/account/sign-in')} />
        </View>
      )}

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

      {__DEV__ && user && (
        <SettingsSection title={t('settings.developer')}>
          {/* Placeholders for Phases 2D–2E. */}
          <InfoRow label={t('account.lastSynced')} value={t('account.comingLater')} />
          <ActionRow label={t('account.signOut')} icon="log-out-outline" disabled onPress={() => {}} />
          <ActionRow label={t('account.deleteAccount')} icon="trash-outline" disabled onPress={() => {}} />
          <ActionRow
            label={t('selfTest.title')}
            icon="shield-checkmark-outline"
            onPress={() => router.push('/account/self-test')}
          />
        </SettingsSection>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing.sm },
  hint: { paddingHorizontal: spacing.xs },
});
