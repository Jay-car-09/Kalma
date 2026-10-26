import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type ScreenProps = {
  title: string;
  children?: ReactNode;
};

// Standard tab screen: title at the top, generous padding, scrolls when content is long.
// The tab bar handles the bottom edge, so only the top safe area is applied here.
export function Screen({ title, children }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Calm empty-state message, centered in the space below the title.
export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <AppText tone="secondary" style={styles.emptyText}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: screenPadding,
    gap: spacing.xxl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  emptyText: { textAlign: 'center' },
});
