import { Stack } from 'expo-router';

import { useTheme } from '@/theme/useTheme';

// Account → sign-in screens inside the Account tab, so the tab bar and ad banner stay visible.
export default function AccountLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
