import { Pressable, StyleSheet } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain';
  disabled?: boolean;
  /** Compact size for use inside list rows. */
  small?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, small }: ButtonProps) {
  const { colors } = useTheme();
  const look = {
    primary: { backgroundColor: colors.inverseBg, borderColor: colors.inverseBg },
    secondary: { backgroundColor: 'transparent', borderColor: colors.border },
    plain: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, small && styles.small, look, (pressed || disabled) && styles.dim]}>
      <AppText
        variant={small ? 'body' : 'heading'}
        tone={variant === 'primary' ? 'inverse' : variant === 'plain' ? 'secondary' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  small: { minHeight: 36, paddingHorizontal: spacing.lg, borderRadius: radius.chip },
  dim: { opacity: 0.5 },
});
