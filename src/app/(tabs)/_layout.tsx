import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AdBanner } from '@/components/AdBanner';
import { fontFamily } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Filled icon when the tab is active, outline when not.
function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    const { colors } = useTheme();
    const color = focused ? colors.textPrimary : colors.textTertiary;
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  };
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      // The ad banner sits directly above the tab bar, so it shows on every tab.
      tabBar={(props) => (
        <View>
          <AdBanner />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.medium },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="trackers"
        options={{ title: t('tabs.trackers'), tabBarIcon: tabIcon('list', 'list-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarIcon: tabIcon('settings', 'settings-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tabs>
  );
}
