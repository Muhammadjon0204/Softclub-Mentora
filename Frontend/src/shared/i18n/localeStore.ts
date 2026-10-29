/**
 * Module singleton для языка интерфейса — тот же приём, что `theme/themeStore.ts`, включая
 * хранение через `lib/preferenceStorage.ts` (не auth-граница). `index.html` уже выставил
 * `<html lang>` синхронно до первой отрисовки; здесь то же значение читается ещё раз, чтобы стор
 * не разошёлся с DOM.
 */
import { readPreference, writePreference } from '../../lib/preferenceStorage';
import { isLocale, type Locale } from './translations';

const STORAGE_KEY = 'mtf-locale';
const DEFAULT_LOCALE: Locale = 'ru';

function readInitialLocale(): Locale {
  const stored = readPreference(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

let locale: Locale = readInitialLocale();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

document.documentElement.lang = locale;

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (locale === next) return;
  locale = next;
  document.documentElement.lang = locale;
  writePreference(STORAGE_KEY, locale);
  notify();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  if (isLocale(event.newValue)) setLocale(event.newValue);
});
