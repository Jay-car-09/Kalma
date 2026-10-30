import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type ScreenProps = {
  title: string;
  /** Shown to the right of the title, e.g. the + button. */
  action?: ReactNode;
  /** Shows a back button above the title. */
  onBack?: () => void;
  children?: ReactNode;
};

// Standard tab screen: title at the top, generous padding, scrolls when content is long.
// The tab bar handles the bottom edge, so only the top safe area is applied here.
export function Screen({ title, action, onBack, children }: ScreenProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {onBack && (
          <Pressable
            onPress={() => onBack()}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
        )}
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {action}
        </View>
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
  back: { alignSelf: 'flex-start', marginBottom: -spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  title: { flex: 1 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  emptyText: { textAlign: 'center' },
});
