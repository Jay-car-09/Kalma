import 'i18next';

import type en from './locales/en.json';

// Makes t('some.key') autocomplete and flags typos at build time.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
