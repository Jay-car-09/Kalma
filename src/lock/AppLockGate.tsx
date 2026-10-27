import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { shouldLock } from '@/lib/lock';
import { useSettings } from '@/settings/SettingsProvider';
import { screenPadding, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { authenticate, hasScreenLock, isAuthenticating } from './auth';

/**
 * Optional app lock + privacy cover. Mount once, after the app is ready, above the navigator.
 * - Locks on every fresh start, and on return after the "Lock after" time.
 * - Covers the app whenever it leaves the foreground, so the app switcher never shows amounts.
 * A notification tapped while locked still navigates underneath, so its tracker is what you
 * see right after unlocking.
 */
export function AppLockGate() {
  const { appLock, lockAfter, setAppLock } = useSettings();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [locked, setLocked] = useState(appLock); // fresh start always locks
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      // Never trap the user: with no screen lock on the phone there's nothing to check against.
      if (!(await hasScreenLock())) {
        setAppLock(false);
        setLocked(false);
        Alert.alert(t('lock.noScreenLock'));
        return;
      }
      if (await authenticate(t('lock.prompt'), t('common.cancel'))) setLocked(false);
      // Cancel or failure: stay on the lock screen; the Unlock button tries again.
    } finally {
      prompting.current = false;
    }
  }, [setAppLock, t]);

  useEffect(() => {
    if (appLock) return;
    setLocked(false);
    setCovered(false);
  }, [appLock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      // The unlock prompt itself can briefly background the app; that isn't "leaving".
      if (!appLock || isAuthenticating()) return;
      if (state === 'active') {
        setCovered(false);
        if (shouldLock(lockAfter, backgroundedAt.current, Date.now())) setLocked(true);
        backgroundedAt.current = null;
      } else {
        setCovered(true); // 'inactive' is when iOS takes the app-switcher snapshot
        if (state === 'background' && backgroundedAt.current === null) backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [appLock, lockAfter]);

  // Prompt automatically whenever the lock screen appears with the app in front.
  useEffect(() => {
    if (locked && AppState.currentState === 'active') unlock();
  }, [locked, unlock]);

  if (!locked && !covered) return null;

  return (
    <>
      {/* Drawn in the same frame as the app, so nothing shows before the modal appears. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      {/* A modal also covers any open sheet (Add tracker, Mark paid…). */}
      <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <AppText variant="hero" accessibilityRole="header">
            {t('app.name')}
          </AppText>
          {locked && (
            <>
              <AppText tone="secondary" style={styles.center}>
                {t('lock.locked')}
              </AppText>
              <View style={styles.button}>
                <Button label={t('lock.unlock')} onPress={unlock} />
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: screenPadding },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});
