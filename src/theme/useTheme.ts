import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useSettings } from '@/settings/SettingsProvider';

import { colors, type ColorScheme, type ThemeColors } from './tokens';

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const { theme } = useSettings();
  const system = useColorScheme();
  const scheme: ColorScheme = theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : theme;
  return { scheme, colors: colors[scheme] };
}

// Keeps native pieces (keyboard, alerts, pickers) in step with the user's theme choice.
export function useSyncNativeAppearance() {
  const { theme, loaded } = useSettings();
  useEffect(() => {
    if (!loaded) return;
    Appearance.setColorScheme(theme === 'system' ? 'auto' : theme);
  }, [theme, loaded]);
}
