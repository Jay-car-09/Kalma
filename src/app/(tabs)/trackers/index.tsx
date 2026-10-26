import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import { dueState, StatusBadge, UrgencyChip } from '@/components/Badges';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { showLimitPrompt } from '@/components/limitPrompt';
import { EmptyState, Screen } from '@/components/Screen';
import { getLimits } from '@/data/limits';
import {
  getUsage,
  listTrackers,
  type Direction,
  type Tracker,
  type TrackerStatus,
} from '@/data/trackers';
import { useQuery } from '@/data/useQuery';
import { formatDate } from '@/lib/dates';
import { useIsPaid } from '@/settings/tier';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const DIRECTIONS = ['all', 'owe', 'owed_to_me'] as const;
// "Overdue" is a view of Active trackers (data-model §4), opened from the dashboard.
const STATUSES = ['active', 'overdue', 'done', 'archived'] as const;

const pick = <T extends string>(value: string | undefined, allowed: readonly T[]): T =>
  allowed.includes(value as T) ? (value as T) : allowed[0];

export default function TrackersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isPaid = useIsPaid();
  const { colors } = useTheme();
  // Filters live in the URL (e.g. /trackers?status=overdue) so the dashboard can open them.
  const params = useLocalSearchParams<{ direction?: string; status?: string }>();
  const direction: Direction | 'all' = pick(params.direction, DIRECTIONS);
  const status: TrackerStatus | 'overdue' = pick(params.status, STATUSES);

  // Reloads when the screen comes back into view and after any change (add, edit, Undo…).
  const data = useQuery(async () => {
    const [list, usage] = await Promise.all([
      listTrackers({ direction, status: status === 'overdue' ? 'active' : status }),
      getUsage(),
    ]);
    return [status === 'overdue' ? list.filter((tr) => dueState(tr) === 'overdue') : list, usage] as const;
  }, [direction, status]);

  async function onAdd() {
    if ((await getUsage()).trackers >= getLimits(isPaid).trackers) {
      showLimitPrompt('trackers', t);
      return;
    }
    router.push('/tracker-sheet');
  }

  const limits = getLimits(false);
  const addButton = (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={t('trackers.add')}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.add, { backgroundColor: colors.inverseBg }, pressed && styles.pressed]}>
      <Ionicons name="add" size={24} color={colors.inverseText} />
    </Pressable>
  );

  if (!data) return <Screen title={t('trackers.title')} action={addButton} />;
  const [trackers, usage] = data;

  return (
    <Screen title={t('trackers.title')} action={addButton}>
      {!isPaid && (
        <View style={styles.usage}>
          <AppText variant="caption" tone="secondary">
            {t('trackers.notifiedUsage', { count: usage.notified, limit: limits.notified })}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('trackers.trackerUsage', { count: usage.trackers, limit: limits.trackers })}
          </AppText>
        </View>
      )}

      {usage.trackers === 0 ? (
        <EmptyState message={t('trackers.empty')} />
      ) : (
        <>
          <View style={styles.filters}>
            <Chips
              options={DIRECTIONS.map((value) => ({ value, label: t(`trackers.filter.${value}`) }))}
              value={direction}
              onChange={(value) => router.setParams({ direction: value })}
            />
            <Chips
              options={STATUSES.map((value) => ({
                value,
                label: value === 'overdue' ? t('tracker.overdue') : t(`tracker.status.${value}`),
              }))}
              value={status}
              onChange={(value) => router.setParams({ status: value })}
            />
          </View>

          {trackers.length === 0 ? (
            <EmptyState message={t('trackers.emptyFilter')} />
          ) : (
            // shortcut: plain list, fine for Free's 10; switch to FlatList if Paid users keep hundreds.
            <View style={styles.list}>
              {trackers.map((tracker) => (
                <TrackerRow
                  key={tracker.id}
                  tracker={tracker}
                  onPress={() => router.push(`/trackers/${tracker.id}`)}
                  onMarkPaid={() => router.push({ pathname: '/payment-sheet', params: { trackerId: tracker.id } })}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

type RowProps = { tracker: Tracker; onPress: () => void; onMarkPaid: () => void };

function TrackerRow({ tracker, onPress, onMarkPaid }: RowProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const due = t('tracker.dueOn', { date: formatDate(tracker.dueDate, i18n.language) });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.rowLine}>
        <AppText variant="heading" numberOfLines={1} style={styles.grow}>
          {tracker.name}
        </AppText>
        <Amount centavos={tracker.amountCentavos} variant="heading" />
      </View>
      <View style={styles.rowLine}>
        <AppText variant="caption" tone="secondary" style={styles.grow}>
          {tracker.direction === 'owed_to_me' ? `${t('tracker.direction.owed_to_me')} · ${due}` : due}
        </AppText>
        <View style={styles.badges}>
          <StatusBadge tracker={tracker} />
          <UrgencyChip urgency={tracker.urgency} />
          {tracker.notify && (
            <Ionicons
              name="notifications-outline"
              size={16}
              color={colors.textSecondary}
              accessibilityLabel={t('tracker.notifyOn')}
            />
          )}
        </View>
      </View>
      {tracker.status === 'active' && (
        <View style={styles.rowAction}>
          <Button
            small
            variant="secondary"
            label={tracker.direction === 'owed_to_me' ? t('payment.received') : t('payment.paid')}
            onPress={onMarkPaid}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usage: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs, marginTop: -spacing.lg },
  filters: { gap: spacing.md },
  list: { gap: spacing.md },
  row: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
  rowAction: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
