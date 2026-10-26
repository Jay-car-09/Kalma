import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import type { Tracker } from '@/data/trackers';
import type { Dashboard } from '@/lib/dashboard';
import { daysBetween, formatDate } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Card, SplitBar } from './parts';

// Core dashboard cards (docs/dashboard.md layout 2–5). Each stands alone; see registry.ts.

type Props = { data: Dashboard };

export function HeroCard({ data }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { paid, unpaid } = data.dueThisMonth;
  const total = paid + unpaid;

  return (
    <Pressable
      onPress={() => router.navigate({ pathname: '/trackers', params: { direction: 'owe', status: 'active' } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <AppText variant="caption" tone="secondary">
        {t('home.dueThisMonth')}
      </AppText>
      {total === 0 ? (
        <AppText variant="heading" tone="secondary">
          {t('home.nothingDue')}
        </AppText>
      ) : (
        <>
          <Amount centavos={unpaid} variant="hero" />
          <View style={styles.inline}>
            <Amount centavos={paid} tone="secondary" />
            <AppText tone="secondary">{t('home.paidOf')}</AppText>
            <Amount centavos={total} tone="secondary" />
          </View>
          <SplitBar
            part={paid}
            whole={total}
            color={colors.paid}
            label={`${formatPeso(paid)} ${t('home.paidOf')} ${formatPeso(total)}`}
          />
        </>
      )}
    </Pressable>
  );
}

export function NextDueCard({ data }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const tracker = data.nextDue;
  if (!tracker) return null;

  const days = daysBetween(data.today, tracker.dueDate);
  const when = days === 0 ? t('home.today') : t('home.inDays', { count: days });
  return (
    <Card title={t('home.nextDue')} onPress={() => router.navigate(`/trackers/${tracker.id}`)}>
      <TrackerLine tracker={tracker} />
      <AppText variant="caption" tone="secondary">
        {[
          tracker.direction === 'owed_to_me' ? t('tracker.direction.owed_to_me') : null,
          formatDate(tracker.dueDate, i18n.language),
          when,
        ]
          .filter(Boolean)
          .join(' · ')}
      </AppText>
    </Card>
  );
}

export function AttentionCard({ data }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  if (data.overdue.length === 0) return null;
  const extra = data.overdue.length - 3;

  return (
    <Card title={t('home.needsAttention')} tint="overdue">
      {data.overdue.slice(0, 3).map((tracker) => (
        <Pressable
          key={tracker.id}
          onPress={() => router.navigate(`/trackers/${tracker.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}>
          <TrackerLine tracker={tracker} />
          <AppText variant="caption" style={{ color: colors.overdue }}>
            {t('home.wasDue', { date: formatDate(tracker.dueDate, i18n.language) })}
          </AppText>
        </Pressable>
      ))}
      <View style={styles.inline}>
        {extra > 0 && (
          <AppText variant="caption" tone="secondary" style={styles.grow}>
            {t('home.moreOverdue', { count: extra })}
          </AppText>
        )}
        <Pressable
          onPress={() => router.navigate({ pathname: '/trackers', params: { direction: 'all', status: 'overdue' } })}
          accessibilityRole="button"
          hitSlop={spacing.sm}
          style={styles.seeAll}>
          <AppText variant="heading" style={{ color: colors.overdue }}>
            {t('home.seeAll')}
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

export function TotalsCard({ data }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = (direction: 'owe' | 'owed_to_me') =>
    router.navigate({ pathname: '/trackers', params: { direction, status: 'active' } });

  return (
    // Two separate cards, never netted (docs/dashboard.md §5).
    <View style={styles.totals}>
      <Card title={t('home.totalDebt')} onPress={() => open('owe')} style={styles.total}>
        {data.totalDebt == null ? (
          <AppText variant="caption" tone="tertiary">
            {t('home.totalDebtHint')}
          </AppText>
        ) : (
          <Amount centavos={data.totalDebt} variant="heading" />
        )}
      </Card>
      <Card title={t('home.owedToYou')} onPress={() => open('owed_to_me')} style={styles.total}>
        <View>
          <Amount centavos={data.owedToYou.unpaid} variant="heading" />
          <AppText variant="caption" tone="secondary">
            {t('home.dueThisMonthShort')}
          </AppText>
        </View>
        {data.owedToYou.remaining != null && (
          <View style={styles.inline}>
            <Amount centavos={data.owedToYou.remaining} variant="caption" tone="secondary" />
            <AppText variant="caption" tone="secondary">
              {t('home.remainingTotal')}
            </AppText>
          </View>
        )}
      </Card>
    </View>
  );
}

function TrackerLine({ tracker }: { tracker: Tracker }) {
  return (
    <View style={styles.inline}>
      <AppText variant="heading" numberOfLines={1} style={styles.grow}>
        {tracker.name}
      </AppText>
      <Amount centavos={tracker.amountCentavos} variant="heading" />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xs },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
  attentionRow: { gap: spacing.xs },
  seeAll: { marginLeft: 'auto' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  total: { flex: 1, minWidth: 150 },
});
