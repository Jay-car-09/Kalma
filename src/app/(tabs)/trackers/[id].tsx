import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import { StatusBadge, UrgencyChip } from '@/components/Badges';
import { Button } from '@/components/Button';
import { EmptyState, Screen } from '@/components/Screen';
import { deletePayment, listPayments, type Payment } from '@/data/payments';
import { deleteTracker, getTracker, setArchived, type Tracker } from '@/data/trackers';
import { useQuery } from '@/data/useQuery';
import { formatDate } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrenceText';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function TrackerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const data = useQuery(() => Promise.all([getTracker(id), listPayments(id)]), [id]);

  if (!data) return <Screen title="" onBack={router.back} />;
  const [tracker, history] = data;
  if (!tracker) {
    return (
      <Screen title="" onBack={router.back}>
        <EmptyState message={t('tracker.notFound')} />
      </Screen>
    );
  }

  const archived = tracker.status === 'archived';
  const received = tracker.direction === 'owed_to_me';

  function confirmDelete() {
    Alert.alert(t('tracker.deleteTitle'), t('tracker.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tracker.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTracker(id);
          router.back();
        },
      },
    ]);
  }

  function onEntryPress(entry: Payment) {
    if (entry.kind === 'payment') {
      router.push({ pathname: '/payment-sheet', params: { paymentId: entry.id } });
      return;
    }
    // Adjustments are a difference, not a typed amount, so they can only be removed.
    Alert.alert(t('history.deleteAdjustmentTitle'), t('history.deleteAdjustmentMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tracker.delete'), style: 'destructive', onPress: () => deletePayment(entry.id) },
    ]);
  }

  const facts: [string, ReactNode][] = [
    [t('tracker.field.dueDate'), formatDate(tracker.dueDate, i18n.language)],
    [t('tracker.field.repeat'), describeRecurrence(tracker.recurrence, tracker.dueDate, t, i18n.language)],
    [t('tracker.field.type'), t(`tracker.type.${tracker.debtType}`)],
    [t('tracker.field.urgency'), <UrgencyChip key="u" urgency={tracker.urgency} />],
    [t('tracker.field.notify'), tracker.notify ? t('tracker.notifyOn') : t('tracker.notifyOff')],
  ];
  if (tracker.remainingCentavos != null) {
    facts.push([t('tracker.remainingBalance'), <Amount key="b" centavos={tracker.remainingCentavos} />]);
  }
  if (tracker.interestRate != null) {
    facts.push([
      t('tracker.field.interestRate'),
      t(`tracker.interestValue.${tracker.interestPeriod ?? 'monthly'}`, { rate: tracker.interestRate }),
    ]);
  }
  if (tracker.statementCutoffDay != null) {
    facts.push([t('tracker.field.cutoff'), t('tracker.cutoffValue', { day: tracker.statementCutoffDay })]);
  }

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const divider = { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth };

  return (
    <Screen title={tracker.name} onBack={router.back}>
      <View style={styles.hero}>
        <AppText variant="caption" tone="secondary">
          {t(`tracker.direction.${tracker.direction}`)}
        </AppText>
        <Amount centavos={tracker.amountCentavos} variant="hero" />
        <View style={styles.badgeRow}>
          <StatusBadge tracker={tracker} />
        </View>
      </View>

      {tracker.status === 'active' && (
        <Button
          label={received ? t('payment.markReceived') : t('payment.markPaid')}
          onPress={() => router.push({ pathname: '/payment-sheet', params: { trackerId: id } })}
        />
      )}

      <View style={styles.section}>
        <View style={card}>
          {facts.map(([label, value], i) => (
            <View key={label} style={[styles.fact, i > 0 && divider]}>
              <AppText tone="secondary" style={styles.factLabel}>
                {label}
              </AppText>
              {typeof value === 'string' ? <AppText style={styles.factValue}>{value}</AppText> : value}
            </View>
          ))}
        </View>
        {tracker.remainingCentavos != null && (
          <Button
            label={t('balance.title')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/balance-sheet', params: { trackerId: id } })}
          />
        )}
      </View>

      {tracker.notes ? (
        <View style={styles.section}>
          <AppText variant="caption" tone="secondary">
            {t('tracker.field.notes')}
          </AppText>
          <AppText>{tracker.notes}</AppText>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="heading">{t('history.title')}</AppText>
        {history.length === 0 ? (
          <AppText tone="secondary">{t('history.empty')}</AppText>
        ) : (
          <View style={card}>
            {history.map((entry, i) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                received={received}
                style={i > 0 ? divider : undefined}
                onPress={() => onEntryPress(entry)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label={t('tracker.edit')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/tracker-sheet', params: { id } })}
        />
        <Button
          label={archived ? t('tracker.unarchive') : t('tracker.archive')}
          variant="secondary"
          onPress={() => setArchived(id, !archived)}
        />
        <Button label={t('tracker.delete')} variant="plain" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

type HistoryRowProps = {
  entry: Payment;
  received: boolean;
  style?: object;
  onPress: () => void;
};

function HistoryRow({ entry, received, style, onPress }: HistoryRowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const isPayment = entry.kind === 'payment';
  const kind = isPayment
    ? received
      ? t('history.kind.received')
      : t('history.kind.payment')
    : entry.amountCentavos > 0
      ? t('history.kind.balanceUp')
      : t('history.kind.balanceDown');
  const meta = [formatDate(entry.paidOn, i18n.language)];
  if (entry.occurrenceDueDate) {
    meta.push(t('payment.forDue', { date: formatDate(entry.occurrenceDueDate, i18n.language) }));
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.entry, style, pressed && styles.pressed]}>
      <View style={styles.entryLine}>
        <AppText style={styles.grow}>{kind}</AppText>
        {/* Green only for money actually paid (CLAUDE.md §7); adjustments stay grey. */}
        <Amount
          centavos={Math.abs(entry.amountCentavos)}
          tone={isPayment ? 'primary' : 'secondary'}
          style={isPayment ? { color: colors.paid } : undefined}
        />
      </View>
      <AppText variant="caption" tone="secondary">
        {meta.join(' · ')}
      </AppText>
      {entry.note ? (
        <AppText variant="caption" tone="tertiary">
          {entry.note}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginTop: -spacing.lg },
  badgeRow: { flexDirection: 'row' },
  section: { gap: spacing.md },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  factLabel: { flexShrink: 1 },
  factValue: { flexShrink: 1, textAlign: 'right' },
  entry: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  entryLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
  actions: { gap: spacing.md },
});
