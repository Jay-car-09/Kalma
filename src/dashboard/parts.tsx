import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Shared building blocks for dashboard cards. Charts are plain Views — no chart library.

type CardProps = {
  title?: string;
  /** Red tint for overdue only (CLAUDE.md §7). */
  tint?: 'overdue';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  children: ReactNode;
};

export function Card({ title, tint, onPress, accessibilityLabel, style, children }: CardProps) {
  const { colors } = useTheme();
  const look = {
    backgroundColor: tint ? colors.overdueBg : colors.surface,
    borderColor: tint ? colors.overdueBg : colors.border,
  };
  const content = (
    <>
      {title && (
        <AppText variant="caption" tone="secondary" style={tint && { color: colors.overdue }}>
          {title}
        </AppText>
      )}
      {children}
    </>
  );
  if (!onPress) return <View style={[styles.card, look, style]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, look, style, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/** Thin two-part bar, e.g. paid (green) vs unpaid (light grey). `part` and `whole` are any unit. */
export function SplitBar({ part, whole, color, label }: { part: number; whole: number; color: string; label: string }) {
  const { colors } = useTheme();
  const share = whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** One labelled horizontal bar row (label left, value right, bar beneath). */
export function BarRow({ label, value, share, color }: { label: string; value: ReactNode; share: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabels}>
        <AppText style={styles.grow}>{label}</AppText>
        {typeof value === 'string' || typeof value === 'number' ? <AppText>{value}</AppText> : value}
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${Math.min(1, share) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  barRow: { gap: spacing.xs },
  barLabels: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
});
