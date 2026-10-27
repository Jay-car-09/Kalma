import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { LockAfter } from '@/lib/lock';
import { readSetting, writeSetting } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguagePreference = 'en' | 'tl' | 'system';

type Settings = {
  theme: ThemePreference;
  language: LanguagePreference;
  // Dev-only "Pretend Paid" switch. Read the tier through useIsPaid(), not this.
  pretendPaid: boolean;
  /** Local time reminders fire, 'HH:MM'. */
  reminderTime: string;
  /** Show peso amounts in notification text (off keeps them off the lock screen). */
  showAmounts: boolean;
  /** Optional app lock (device-local, off by default). */
  appLock: boolean;
  lockAfter: LockAfter;
};

type SettingsContextValue = Settings & {
  loaded: boolean;
  setTheme: (value: ThemePreference) => void;
  setLanguage: (value: LanguagePreference) => void;
  setPretendPaid: (value: boolean) => void;
  setReminderTime: (value: string) => void;
  setShowAmounts: (value: boolean) => void;
  setAppLock: (value: boolean) => void;
  setLockAfter: (value: LockAfter) => void;
};

const DEFAULTS: Settings = {
  theme: 'system',
  language: 'system',
  pretendPaid: false,
  reminderTime: '09:00',
  showAmounts: false,
  appLock: false,
  lockAfter: '1m',
};

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGES: readonly LanguagePreference[] = ['en', 'tl', 'system'];
const LOCK_AFTER: readonly LockAfter[] = ['immediately', '1m', '5m'];

const SettingsContext = createContext<SettingsContextValue | null>(null);

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all(
      ['theme', 'language', 'pretendPaid', 'reminderTime', 'showAmounts', 'appLock', 'lockAfter'].map(readSetting),
    ).then(([theme, language, pretendPaid, reminderTime, showAmounts, appLock, lockAfter]) => {
      setSettings({
        theme: pick(theme, THEMES, DEFAULTS.theme),
        language: pick(language, LANGUAGES, DEFAULTS.language),
        pretendPaid: pretendPaid === 'true',
        reminderTime: reminderTime && /^\d{2}:\d{2}$/.test(reminderTime) ? reminderTime : DEFAULTS.reminderTime,
        showAmounts: showAmounts === 'true',
        appLock: appLock === 'true',
        lockAfter: pick(lockAfter, LOCK_AFTER, DEFAULTS.lockAfter),
      });
      setLoaded(true);
    });
  }, []);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((s) => ({ ...s, theme }));
    writeSetting('theme', theme);
  }, []);

  const setLanguage = useCallback((language: LanguagePreference) => {
    setSettings((s) => ({ ...s, language }));
    writeSetting('language', language);
  }, []);

  const setPretendPaid = useCallback((pretendPaid: boolean) => {
    setSettings((s) => ({ ...s, pretendPaid }));
    writeSetting('pretendPaid', String(pretendPaid));
  }, []);

  const setReminderTime = useCallback((reminderTime: string) => {
    setSettings((s) => ({ ...s, reminderTime }));
    writeSetting('reminderTime', reminderTime);
  }, []);

  const setShowAmounts = useCallback((showAmounts: boolean) => {
    setSettings((s) => ({ ...s, showAmounts }));
    writeSetting('showAmounts', String(showAmounts));
  }, []);

  const setAppLock = useCallback((appLock: boolean) => {
    setSettings((s) => ({ ...s, appLock }));
    writeSetting('appLock', String(appLock));
  }, []);

  const setLockAfter = useCallback((lockAfter: LockAfter) => {
    setSettings((s) => ({ ...s, lockAfter }));
    writeSetting('lockAfter', lockAfter);
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      loaded,
      setTheme,
      setLanguage,
      setPretendPaid,
      setReminderTime,
      setShowAmounts,
      setAppLock,
      setLockAfter,
    }),
    [settings, loaded, setTheme, setLanguage, setPretendPaid, setReminderTime, setShowAmounts, setAppLock, setLockAfter],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
