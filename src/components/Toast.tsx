import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

type Toast = { message: string; actionLabel?: string; onAction?: () => void };

const DURATION_MS = 5000;
let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(toast: Toast | null) {
  current = toast;
  listeners.forEach((l) => l());
}

/** Brief message with an optional action (e.g. "Marked as paid · Undo"). Replaces any current one. */
export function showToast(toast: Toast) {
  clearTimeout(timer);
  set(toast);
  AccessibilityInfo.announceForAccessibility(toast.message);
  timer = setTimeout(() => set(null), DURATION_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Rendered once, floating just above the ad banner / tab bar (see app/(tabs)/_layout.tsx).
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, () => current);
  const { colors } = useTheme();
  if (!toast) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.toast, { backgroundColor: colors.inverseBg }]} accessibilityLiveRegion="polite">
        <AppText tone="inverse" style={styles.message}>
          {toast.message}
        </AppText>
        {toast.actionLabel && (
          <Pressable
            onPress={() => {
              clearTimeout(timer);
              set(null);
              toast.onAction?.();
            }}
            hitSlop={spacing.md}
            accessibilityRole="button">
            <AppText variant="heading" tone="inverse">
              {toast.actionLabel}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: '100%', left: spacing.lg, right: spacing.lg, paddingBottom: spacing.sm },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
  },
  message: { flex: 1 },
});
