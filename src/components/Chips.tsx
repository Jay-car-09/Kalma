import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type ChipsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Stretch the chips to share the row equally (used for two-way switches). */
  fill?: boolean;
};

// Single-choice chip row. Wraps onto new lines so longer Tagalog labels never get cut.
export function Chips<T extends string>({ options, value, onChange, fill }: ChipsProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              fill && styles.fill,
              {
                backgroundColor: selected ? colors.inverseBg : colors.surface,
                borderColor: selected ? colors.inverseBg : colors.border,
              },
              pressed && styles.pressed,
            ]}>
            <AppText tone={selected ? 'inverse' : 'primary'} style={styles.label}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: { flex: 1 },
  label: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
