import { useLocales } from 'expo-localization';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettings } from '@/settings/SettingsProvider';

import { toAppLanguage } from './index';

// Applies the user's language choice, following the phone when set to "system".
// Returns true once the app is showing the right language.
export function useSyncLanguage(): boolean {
  const { language } = useSettings();
  const { i18n } = useTranslation();
  const phone = toAppLanguage(useLocales()[0]?.languageCode);
  const target = language === 'system' ? phone : language;

  useEffect(() => {
    if (i18n.language !== target) i18n.changeLanguage(target);
  }, [i18n, target]);

  return i18n.language === target;
}
