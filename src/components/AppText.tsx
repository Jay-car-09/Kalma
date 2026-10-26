import { Text, type TextProps } from 'react-native';

import { typography, type ThemeColors, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'inverse';

const toneColor: Record<TextTone, keyof ThemeColors> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'inverseText',
};

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
};

// All app text goes through this so it gets Inter, the type scale and theme colors.
export function AppText({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return <Text style={[typography[variant], { color: colors[toneColor[tone]] }, style]} {...rest} />;
}
