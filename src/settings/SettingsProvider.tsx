import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
};

type SettingsContextValue = Settings & {
  loaded: boolean;
  setTheme: (value: ThemePreference) => void;
  setLanguage: (value: LanguagePreference) => void;
  setPretendPaid: (value: boolean) => void;
  setReminderTime: (value: string) => void;
  setShowAmounts: (value: boolean) => void;
};

const DEFAULTS: Settings = {
  theme: 'system',
  language: 'system',
  pretendPaid: false,
  reminderTime: '09:00',
  showAmounts: false,
};

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGES: readonly LanguagePreference[] = ['en', 'tl', 'system'];

const SettingsContext = createContext<SettingsContextValue | null>(null);

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all(
      ['theme', 'language', 'pretendPaid', 'reminderTime', 'showAmounts'].map(readSetting),
    ).then(([theme, language, pretendPaid, reminderTime, showAmounts]) => {
      setSettings({
        theme: pick(theme, THEMES, DEFAULTS.theme),
        language: pick(language, LANGUAGES, DEFAULTS.language),
        pretendPaid: pretendPaid === 'true',
        reminderTime: reminderTime && /^\d{2}:\d{2}$/.test(reminderTime) ? reminderTime : DEFAULTS.reminderTime,
        showAmounts: showAmounts === 'true',
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

  const value = useMemo(
    () => ({ ...settings, loaded, setTheme, setLanguage, setPretendPaid, setReminderTime, setShowAmounts }),
    [settings, loaded, setTheme, setLanguage, setPretendPaid, setReminderTime, setShowAmounts],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
