import '@/i18n';

// Import only the weights we use, so the other 14 font files stay out of the app.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from '@expo-google-fonts/inter/useFonts';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { prepareDatabase } from '@/data/db';
import { useSyncLanguage } from '@/i18n/useSyncLanguage';
import { AppLockGate } from '@/lock/AppLockGate';
import { useReminderSync } from '@/reminders/useReminderSync';
import { SettingsProvider, useSettings } from '@/settings/SettingsProvider';
import { useSyncNativeAppearance, useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RootNavigator />
    </SettingsProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { loaded: settingsLoaded } = useSettings();
  const languageReady = useSyncLanguage();
  const { scheme, colors } = useTheme();
  useSyncNativeAppearance();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    prepareDatabase().then(() => setDbReady(true), setDbError);
  }, []);
  // Show the router's error screen rather than run on a half-migrated database.
  if (dbError) throw dbError;

  // Keep the splash screen up until fonts, saved settings, language and database are ready,
  // so the app never flashes the wrong theme, font or language.
  const ready = (fontsLoaded || fontError != null) && settingsLoaded && languageReady && dbReady;
  useReminderSync(ready);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.textPrimary,
      background: colors.background,
      card: colors.background,
      text: colors.textPrimary,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tracker-sheet" options={{ presentation: 'modal' }} />
        <Stack.Screen name="payment-sheet" options={{ presentation: 'modal' }} />
        <Stack.Screen name="balance-sheet" options={{ presentation: 'modal' }} />
      </Stack>
      <AppLockGate />
    </ThemeProvider>
  );
}
