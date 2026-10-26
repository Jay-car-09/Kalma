import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import tl from './locales/tl.json';

export type AppLanguage = 'en' | 'tl';

// Typed as `typeof en` so a key missing from tl.json is a TypeScript error.
const tlStrings: typeof en = tl;

// Phones set to Filipino report "fil" (iOS) or "tl"/"fil" (Android).
export function toAppLanguage(languageCode: string | null | undefined): AppLanguage {
  return languageCode === 'tl' || languageCode === 'fil' ? 'tl' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tl: { translation: tlStrings },
  },
  lng: toAppLanguage(getLocales()[0]?.languageCode),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
