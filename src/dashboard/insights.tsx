import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AppText } from '@/components/AppText';
import type { Urgency } from '@/data/trackers';
import type { Dashboard } from '@/lib/dashboard';
import { formatMonth } from '@/lib/dates';
import { formatPeso } from '@/lib/money';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { BarRow, Card, SplitBar } from './parts';

// Insights (docs/dashboard.md §6): descriptive only — no projections, no advice.
// Greyscale, except green for paid / on-time.

type Props = { data: Dashboard };

const CHART_HEIGHT = 96;

export function PaymentsByMonthCard({ data }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const max = Math.max(...data.paymentsByMonth.map((m) => m.total));
  const total = data.paymentsByMonth.reduce((sum, m) => sum + m.total, 0);

  return (
    <Card title={t('home.paymentsByMonth')}>
      <View style={styles.columns}>
        {data.paymentsByMonth.map(({ month, total: value }) => {
          const current = month === data.month;
          return (
            <View
              key={month}
              style={styles.column}
              accessible
              accessibilityLabel={`${formatMonth(month, i18n.language)}: ${formatPeso(value)}`}>
              <View style={styles.columnTrack}>
                <View
                  style={[
                    styles.columnBar,
                    {
                      height: max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * CHART_HEIGHT) : 0,
                      backgroundColor: current ? colors.textPrimary : colors.textTertiary,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" tone={current ? 'primary' : 'tertiary'}>
                {formatMonth(month, i18n.language, 'short')}
              </AppText>
            </View>
          );
        })}
      </View>
      <View style={styles.inline}>
        <Amount centavos={total} tone="secondary" />
        <AppText tone="secondary">{t('home.sixMonthTotal')}</AppText>
      </View>
    </Card>
  );
}

export function ByTypeCard({ data }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const max = data.dueByType[0]?.total ?? 0;
  return (
    <Card title={t('home.byType')}>
      {data.dueByType.map(({ type, total }) => (
        <BarRow
          key={type}
          label={t(`tracker.type.${type}`)}
          value={<Amount centavos={total} />}
          share={max > 0 ? total / max : 0}
          color={colors.textSecondary}
        />
      ))}
    </Card>
  );
}

export function OnTimeCard({ data }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t('home.onTimeCount', { onTime: data.onTime.onTime, total: data.onTime.total });
  return (
    <Card title={t('home.onTime')}>
      <AppText>{label}</AppText>
      <SplitBar part={data.onTime.onTime} whole={data.onTime.total} color={colors.paid} label={label} />
    </Card>
  );
}

export function ByUrgencyCard({ data }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const max = Math.max(...Object.values(data.byUrgency));
  // Greyscale only (CLAUDE.md §4): High darkest, Low lightest.
  const shade: Record<Urgency, string> = {
    high: colors.inverseBg,
    normal: colors.textSecondary,
    low: colors.textTertiary,
  };
  return (
    <Card title={t('home.byUrgency')}>
      {(['high', 'normal', 'low'] as const).map((urgency) => (
        <BarRow
          key={urgency}
          label={t(`tracker.urgency.${urgency}`)}
          value={data.byUrgency[urgency]}
          share={max > 0 ? data.byUrgency[urgency] / max : 0}
          color={shade[urgency]}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs },
  columnTrack: { height: CHART_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  columnBar: { width: '60%', borderRadius: 3 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
