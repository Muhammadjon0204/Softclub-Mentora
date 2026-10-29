/**
 * Module singleton для темы — тот же приём, что `auth/tokenStore.ts`: значение вне React,
 * компоненты подписываются через `useSyncExternalStore` (см. `useTheme.ts`). Хранение —
 * `lib/preferenceStorage.ts`, не `localStorage` напрямую: это не auth-граница, ESLint не пускает
 * сырой `localStorage` никуда, кроме того единственного модуля.
 *
 * `index.html` уже выставил `data-theme` синхронно до первой отрисовки (без этого — вспышка
 * светлой темы на тёмных настройках, пока не догрузился и не выполнился этот модуль). Здесь то
 * же самое значение читается ещё раз в `readInitialTheme()`, чтобы стор и DOM не разошлись, если
 * между ними что-то успело измениться — например, другая вкладка через storage-событие (см. ниже).
 */
import { readPreference, writePreference } from '../../lib/preferenceStorage';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mtf-theme';
const TRANSITION_CLASS = 'theme-transition';
const TRANSITION_MS = 450;

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readInitialTheme(): Theme {
  const stored = readPreference(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark() ? 'dark' : 'light';
}

let theme: Theme = readInitialTheme();
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Без анимационного класса — вызывается один раз при загрузке модуля, страница ещё не видна пользователю как «смена темы». */
document.documentElement.dataset.theme = theme;

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme): void {
  if (theme === next) return;
  theme = next;

  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  root.dataset.theme = theme;
  if (transitionTimer !== null) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = null;
  }, TRANSITION_MS);

  writePreference(STORAGE_KEY, theme);
  notify();
}

export function toggleTheme(): void {
  setTheme(theme === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Смена темы в другой вкладке того же браузера подхватывается без перезагрузки. */
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  const next = event.newValue;
  if (next === 'light' || next === 'dark') setTheme(next);
});
