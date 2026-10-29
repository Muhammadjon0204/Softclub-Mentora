import { useSyncExternalStore } from 'react';

import { getLocale, setLocale, subscribeLocale } from './localeStore';
import { translate, type Locale } from './translations';

export interface UseTranslationResult {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** `t('nav.admin.dashboard')` — см. `translations.ts: resolve()` для правил пути и fallback. */
  t: (key: string) => string;
}

const getServerSnapshot = (): Locale => 'ru';

export function useTranslation(): UseTranslationResult {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerSnapshot);
  return { locale, setLocale, t: (key: string) => translate(locale, key) };
}
