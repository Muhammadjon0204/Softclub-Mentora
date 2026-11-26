import { useSyncExternalStore } from 'react';

import webEn from '../../../Frontend/src/shared/i18n/catalog/en.json';
import webTg from '../../../Frontend/src/shared/i18n/catalog/tg.json';
import mobileEn from '@/i18n/en.json';
import mobileTg from '@/i18n/tg.json';

import { secureStorage } from './secureStorage';

/**
 * Same model as the site: the Russian text is the key, `en`/`tg` catalogs translate it. The app's own
 * strings live in `src/i18n/*.json`; everything shared with the site comes from the web catalogs.
 */
export type Language = 'ru' | 'tg' | 'en';

const catalogs: Record<Exclude<Language, 'ru'>, Record<string, string>> = {
  en: { ...webEn, ...mobileEn },
  tg: { ...webTg, ...mobileTg },
};

const STORAGE_KEY = 'ravand.language';
let language: Language = 'ru';
const listeners = new Set<() => void>();

void secureStorage.get(STORAGE_KEY).then((stored) => {
  if (stored === 'tg' || stored === 'en') setLanguage(stored);
});

export function setLanguage(next: Language): void {
  if (next === language) return;
  language = next;
  void secureStorage.set(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function translate(text: string, lang: Language = language): string {
  return lang === 'ru' ? text : (catalogs[lang][text] ?? text);
}

/** `t('Мои задания')` — re-renders the screen when the language changes. */
export function useT(): { t: (text: string) => string; language: Language; locale: string } {
  const lang = useSyncExternalStore(subscribe, () => language, () => language);
  return {
    t: (text: string) => translate(text, lang),
    language: lang,
    // Dates: Tajik formatting data is often missing from the JS engine; Russian month names are the
    // closest readable fallback for a Tajik reader.
    locale: lang === 'en' ? 'en-GB' : 'ru-RU',
  };
}
