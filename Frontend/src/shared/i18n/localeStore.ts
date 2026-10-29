/**
 * Module singleton для языка интерфейса — тот же приём, что `theme/themeStore.ts`, включая
 * хранение через `lib/preferenceStorage.ts` (не auth-граница). `index.html` уже выставил
 * `<html lang>` синхронно до первой отрисовки; здесь то же значение читается ещё раз, чтобы стор
 * не разошёлся с DOM.
 *
 * Язык меняется только после того, как загружен его каталог (`catalog.ts: ensureCatalog`): иначе
 * на долю секунды был бы виден экран, где часть текста уже переведена, а часть ещё нет.
 */
import { readPreference, writePreference } from '../../lib/preferenceStorage';
import { activateCatalog, ensureCatalog } from './catalog';
import { isLocale, type Locale } from './translations';

const STORAGE_KEY = 'mtf-locale';
const DEFAULT_LOCALE: Locale = 'ru';
const TRANSITION_CLASS = 'locale-transition';
const TRANSITION_MS = 320;

function readInitialLocale(): Locale {
  const stored = readPreference(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

let locale: Locale = readInitialLocale();
let requested: Locale = locale;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

document.documentElement.lang = locale;

export function getLocale(): Locale {
  return locale;
}

/**
 * Готовит язык, сохранённый с прошлого визита, до первой отрисовки (`main.tsx`). Если каталог не
 * загрузился (сеть пропала посреди деплоя), интерфейс остаётся русским, а не пустым.
 */
export function prepareLocale(): Promise<void> {
  return ensureCatalog(locale)
    .then(() => {
      activateCatalog(locale);
    })
    .catch(() => {
      locale = DEFAULT_LOCALE;
      requested = DEFAULT_LOCALE;
      activateCatalog(DEFAULT_LOCALE);
      document.documentElement.lang = locale;
    });
}

function apply(next: Locale): void {
  activateCatalog(next);
  locale = next;

  const root = document.documentElement;
  root.lang = locale;
  // Текст на другом языке другой длины — строки переносятся по-новому. Короткое затухание
  // всего содержимого превращает этот перескок в мягкую смену, а не в дёрганье вёрстки.
  root.classList.remove(TRANSITION_CLASS);
  void root.offsetWidth;
  root.classList.add(TRANSITION_CLASS);
  if (transitionTimer !== null) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = null;
  }, TRANSITION_MS);

  writePreference(STORAGE_KEY, locale);
  notify();
}

export function setLocale(next: Locale): void {
  requested = next;
  if (locale === next) return;
  ensureCatalog(next)
    .then(() => {
      // Пока каталог грузился, могли успеть выбрать другой язык — побеждает последний клик.
      if (requested === next) apply(next);
    })
    .catch(() => {
      if (requested === next) requested = locale;
    });
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
