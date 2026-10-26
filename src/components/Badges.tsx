import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Tracker, Urgency } from '@/data/trackers';
import { addDays, today } from '@/lib/dates';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

function Badge({ label, bg, fg, border }: { label: string; bg: string; fg: string; border: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <AppText variant="caption" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

// Urgency is greyscale only (CLAUDE.md §4): High solid, Normal outlined, Low light grey.
const urgencyStyle = (c: ThemeColors): Record<Urgency, [string, string, string]> => ({
  high: [c.inverseBg, c.inverseText, c.inverseBg],
  normal: ['transparent', c.textPrimary, c.textPrimary],
  low: [c.border, c.textSecondary, c.border],
});

export function UrgencyChip({ urgency }: { urgency: Urgency }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [bg, fg, border] = urgencyStyle(colors)[urgency];
  return <Badge label={t(`tracker.urgency.${urgency}`)} bg={bg} fg={fg} border={border} />;
}

// Overdue = active and past due; Due soon = active and due within 3 days incl. today (data-model §4).
export function dueState(tracker: Pick<Tracker, 'status' | 'dueDate'>): 'overdue' | 'dueSoon' | null {
  if (tracker.status !== 'active') return null;
  const now = today();
  if (tracker.dueDate < now) return 'overdue';
  if (tracker.dueDate <= addDays(now, 2)) return 'dueSoon';
  return null;
}

// Color only where it means something: red = overdue, green = done. Everything else grey.
export function StatusBadge({ tracker }: { tracker: Pick<Tracker, 'status' | 'dueDate'> }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (tracker.status === 'done') {
    return <Badge label={t('tracker.status.done')} bg={colors.paidBg} fg={colors.paid} border={colors.paidBg} />;
  }
  if (tracker.status === 'archived') {
    return (
      <Badge label={t('tracker.status.archived')} bg={colors.surface} fg={colors.textSecondary} border={colors.border} />
    );
  }
  const state = dueState(tracker);
  if (state === 'overdue') {
    return <Badge label={t('tracker.overdue')} bg={colors.overdueBg} fg={colors.overdue} border={colors.overdueBg} />;
  }
  if (state === 'dueSoon') {
    return <Badge label={t('tracker.dueSoon')} bg={colors.surface} fg={colors.textSecondary} border={colors.border} />;
  }
  return null;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
