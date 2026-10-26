import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | null;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.textPrimary}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.textPrimary : colors.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <AppText variant="caption">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    ...typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
