import { Stack } from 'expo-router';

import { useTheme } from '@/theme/useTheme';

// Opening a tracker from Home still puts the list underneath it, so Back lands on the list.
export const unstable_settings = { anchor: 'index' };

// List → detail inside the Trackers tab, so the tab bar and ad banner stay visible.
export default function TrackersLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
