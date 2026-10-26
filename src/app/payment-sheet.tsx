import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DateField, Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { showToast } from '@/components/Toast';
import {
  deletePayment,
  getPayment,
  markPaid,
  updatePayment,
  type Payment,
} from '@/data/payments';
import { getTracker, type Tracker } from '@/data/trackers';
import { addDays, formatDate, today } from '@/lib/dates';
import { centavosToInput, parsePeso } from '@/lib/money';
import { countOverdue, nextOccurrence } from '@/lib/recurrence';
import { spacing } from '@/theme/tokens';

// Mark Paid / Received (with ?trackerId=) or edit a payment from history (with ?paymentId=).
export default function PaymentSheet() {
  const { trackerId, paymentId } = useLocalSearchParams<{ trackerId?: string; paymentId?: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = paymentId ? await getPayment(paymentId) : null;
      const owner = await getTracker(existing?.trackerId ?? trackerId ?? '');
      setPayment(existing);
      setTracker(owner);
      if (existing) {
        setAmount(centavosToInput(existing.amountCentavos));
        setPaidOn(existing.paidOn);
        setNote(existing.note ?? '');
      } else if (owner) {
        setAmount(centavosToInput(owner.amountCentavos)); // defaults to the tracker amount (§5.1)
      }
    })();
  }, [trackerId, paymentId]);

  const received = tracker?.direction === 'owed_to_me';
  const title = payment ? t('payment.editTitle') : received ? t('payment.markReceived') : t('payment.markPaid');

  // Which due date this settles, and how many are still overdue after it.
  const settles = payment ? payment.occurrenceDueDate : tracker?.dueDate;
  const next = tracker && !payment ? nextOccurrence(tracker.recurrence, tracker.dueDate) : null;
  const moreOverdue = tracker && next ? countOverdue(tracker.recurrence, next, today()) : 0;

  async function save() {
    if (!tracker) return;
    const amountCentavos = parsePeso(amount);
    if (!amountCentavos) {
      setError(t('form.error.amount'));
      return;
    }
    const input = { amountCentavos, paidOn, note: note.trim() || null };

    setSaving(true);
    try {
      if (payment) {
        await updatePayment(payment.id, input);
        router.back();
      } else {
        const newId = await markPaid(tracker.id, input);
        router.back();
        showToast({
          message: received ? t('payment.toastReceived') : t('payment.toastPaid'),
          actionLabel: t('payment.undo'),
          onAction: () =>
            deletePayment(newId).catch(() => Alert.alert(t('common.errorTitle'), t('payment.undoFailed'))),
        });
      }
    } catch {
      // Keep the sheet open so nothing typed is lost.
      Alert.alert(t('common.errorTitle'), t('payment.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!payment) return;
    Alert.alert(t('payment.deleteTitle'), t('payment.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tracker.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePayment(payment.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Sheet title={title} onSave={save} saving={saving} ready={tracker !== null}>
      {tracker && (
        <View style={styles.summary}>
          <AppText variant="heading">{tracker.name}</AppText>
          {settles && (
            <AppText tone="secondary">
              {t(payment ? 'payment.forDue' : 'payment.settles', { date: formatDate(settles, i18n.language) })}
            </AppText>
          )}
          {moreOverdue > 0 && (
            <AppText tone="secondary">{t('payment.moreOverdue', { count: moreOverdue })}</AppText>
          )}
        </View>
      )}

      <TextField
        label={t('payment.amount')}
        value={amount}
        onChangeText={setAmount}
        error={error}
        keyboardType="decimal-pad"
        style={styles.tabular}
      />

      <DateField
        label={received ? t('payment.dateReceived') : t('payment.datePaid')}
        value={paidOn}
        onChange={setPaidOn}
        maximumDate={today()}
        quick={[
          { label: t('form.today'), date: today() },
          { label: t('payment.yesterday'), date: addDays(today(), -1) },
        ]}
      />

      <TextField
        label={t('payment.note')}
        value={note}
        onChangeText={setNote}
        multiline
        style={styles.note}
      />

      {payment && <Button label={t('payment.delete')} variant="plain" onPress={confirmDelete} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  note: { minHeight: 72, textAlignVertical: 'top' },
});
