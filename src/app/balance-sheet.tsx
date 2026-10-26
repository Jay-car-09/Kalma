import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { updateRemainingBalance } from '@/data/payments';
import { getTracker, type Tracker } from '@/data/trackers';
import { centavosToInput, parsePeso } from '@/lib/money';
import { spacing } from '@/theme/tokens';

// "Update remaining balance": the difference is saved as an adjustment (data-model §2.3).
export default function BalanceSheet() {
  const { trackerId } = useLocalSearchParams<{ trackerId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTracker(trackerId).then((found) => {
      setTracker(found);
      if (found?.remainingCentavos != null) setBalance(centavosToInput(Math.max(0, found.remainingCentavos)));
    });
  }, [trackerId]);

  async function save() {
    const centavos = parsePeso(balance);
    if (centavos == null) {
      setError(t('form.error.amount'));
      return;
    }
    setSaving(true);
    try {
      await updateRemainingBalance(trackerId, centavos);
      router.back();
    } catch {
      Alert.alert(t('common.errorTitle'), t('balance.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={t('balance.title')}
      onSave={save}
      saving={saving}
      ready={tracker?.remainingCentavos != null}>
      {tracker?.remainingCentavos != null && (
        <View style={styles.summary}>
          <AppText variant="heading">{tracker.name}</AppText>
          <View style={styles.current}>
            <AppText tone="secondary">{t('balance.current')}</AppText>
            <Amount centavos={tracker.remainingCentavos} tone="secondary" />
          </View>
        </View>
      )}
      <TextField
        label={t('balance.newBalance')}
        value={balance}
        onChangeText={setBalance}
        error={error}
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        style={styles.tabular}
      />
      <AppText variant="caption" tone="secondary">
        {t('balance.hint')}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  current: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tabular: { fontVariant: ['tabular-nums'] },
});
