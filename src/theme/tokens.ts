// Kalma design tokens — the single source for colors, spacing, shape and type.
// Values come from CLAUDE.md section 7. Change them here, nowhere else.

export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F6F6F6',
    border: '#E5E5E5',
    textPrimary: '#0A0A0A',
    textSecondary: '#5C5C5C',
    textTertiary: '#8A8A8A',
    inverseBg: '#0A0A0A',
    inverseText: '#FFFFFF',
    overdue: '#C62828',
    overdueBg: '#FDECEC',
    paid: '#2E7D32',
    paidBg: '#EAF5EB',
  },
  dark: {
    background: '#0E0E0E',
    surface: '#1A1A1A',
    border: '#2A2A2A',
    textPrimary: '#F5F5F5',
    textSecondary: '#A3A3A3',
    textTertiary: '#737373',
    inverseBg: '#F5F5F5',
    inverseText: '#0A0A0A',
    overdue: '#EF5350',
    overdueBg: '#3A1C1C',
    paid: '#66BB6A',
    paidBg: '#17301B',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = { [K in keyof typeof colors.light]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const screenPadding = spacing.xl;

export const radius = {
  card: 12,
  chip: 8,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  hero: { fontSize: 40, lineHeight: 48, fontFamily: fontFamily.semiBold },
  title: { fontSize: 24, lineHeight: 32, fontFamily: fontFamily.semiBold },
  heading: { fontSize: 18, lineHeight: 26, fontFamily: fontFamily.semiBold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
} as const;

export type TypographyVariant = keyof typeof typography;

// Standard banner ad size (CLAUDE.md section 6).
export const adBanner = { width: 320, height: 50 } as const;
