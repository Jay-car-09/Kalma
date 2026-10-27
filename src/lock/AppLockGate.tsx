import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { nextLockState, type LockState } from '@/lib/lock';
import { useSettings } from '@/settings/SettingsProvider';
import { screenPadding, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { authenticate, hasScreenLock, isAuthenticating } from './auth';

type LockScreenState = { locked: boolean; covered: boolean; unlock: () => void };

const LockContext = createContext<LockScreenState | null>(null);

/**
 * Optional app lock + privacy cover. Wrap the navigator once, after the app is ready.
 * - Locks on every fresh start, and on return after the "Lock after" time.
 * - Covers the app whenever it leaves the foreground, so the app switcher never shows amounts.
 * A notification tapped while locked still navigates underneath, so its tracker is what you
 * see right after unlocking.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { appLock, lockAfter, setAppLock } = useSettings();
  const { t } = useTranslation();
  const [lock, setLock] = useState<LockState>(() => ({
    locked: appLock, // fresh start always locks
    covered: appLock && AppState.currentState !== 'active',
    backgroundedAt: null,
  }));
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      // Never trap the user: with no screen lock on the phone there's nothing to check against.
      if (!(await hasScreenLock())) {
        setAppLock(false); // the effect below opens the app
        Alert.alert(t('lock.noScreenLock'));
        return;
      }
      if (await authenticate(t('lock.prompt'), t('common.cancel'))) setLock((s) => ({ ...s, locked: false }));
      // Cancel or failure: stay on the lock screen; the Unlock button tries again.
    } finally {
      prompting.current = false;
    }
  }, [setAppLock, t]);

  useEffect(() => {
    if (!appLock) setLock({ locked: false, covered: false, backgroundedAt: null });
  }, [appLock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (appState) => {
      if (!appLock) return;
      const change = { appState, lockAfter, now: Date.now(), authenticating: isAuthenticating() };
      setLock((s) => nextLockState(s, change));
    });
    return () => sub.remove();
  }, [appLock, lockAfter]);

  // Prompt automatically whenever the lock screen is showing with the app in front, including
  // on every return to an already-locked app. A cancelled prompt changes neither, so no loop.
  useEffect(() => {
    if (lock.locked && !lock.covered) unlock();
  }, [lock.locked, lock.covered, unlock]);

  const screen = useMemo(
    () => ({ locked: lock.locked, covered: lock.covered, unlock }),
    [lock.locked, lock.covered, unlock],
  );
  const showing = lock.locked || lock.covered;

  return (
    <LockContext.Provider value={screen}>
      {children}
      {showing && (
        <>
          {/* Drawn in the same frame as the app, so nothing shows before the modal appears. */}
          <View style={StyleSheet.absoluteFill}>
            <LockScreen {...screen} />
          </View>
          {/* On Android this also covers open sheets; on iPhone a sheet covers itself (SheetLockCover). */}
          <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
            <LockScreen {...screen} />
          </Modal>
        </>
      )}
    </LockContext.Provider>
  );
}

/**
 * The lock screen inside a native sheet (Add tracker, Mark paid…). On iPhone the gate's modal
 * can't open on top of a sheet that is already open, so each sheet draws its own.
 */
export function SheetLockCover() {
  const screen = useContext(LockContext);
  if (!screen || (!screen.locked && !screen.covered)) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LockScreen {...screen} />
    </View>
  );
}

function LockScreen({ locked, unlock }: LockScreenState) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: screenPadding },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});
