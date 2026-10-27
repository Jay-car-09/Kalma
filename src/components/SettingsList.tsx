import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      <AppText variant="caption" tone="secondary" style={styles.sectionTitle}>
        {title}
      </AppText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type OptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function OptionRow({ label, selected, onPress }: OptionRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppText style={styles.label}>{label}</AppText>
      {selected && <Ionicons name="checkmark" size={20} color={colors.textPrimary} />}
    </Pressable>
  );
}

type ActionRowProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
};

export function ActionRow({ label, icon, onPress, disabled }: ActionRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, (pressed || disabled) && styles.pressed]}>
      <AppText style={styles.label}>{label}</AppText>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

type SwitchRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ label, hint, value, onValueChange }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <AppText>{label}</AppText>
        {hint && (
          <AppText variant="caption" tone="tertiary">
            {hint}
          </AppText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.inverseBg }}
        ios_backgroundColor={colors.border}
        thumbColor={value ? colors.inverseText : Platform.OS === 'android' ? colors.textTertiary : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.xs },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.6 },
});
