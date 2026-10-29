import { en } from './locales/en';
import { ru, type TranslationTree } from './locales/ru';
import { tg } from './locales/tg';

export const SUPPORTED_LOCALES = ['ru', 'tg', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RESOURCES: Record<Locale, TranslationTree> = { ru, tg, en };

export function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

type PlainObject = Record<string, unknown>;

/** `'nav.admin.dashboard'` -> идёт по вложенным объектам; `undefined`, если путь не долистался до строки. */
function resolve(tree: TranslationTree, path: string): string | undefined {
  let node: unknown = tree;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as PlainObject)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Ключ, которого ещё нет в `tg`/`en` (страница пока переведена не вся, см. итоги задачи
 * i18n), падает на русский, а не на сам ключ — то, что недопереведено, выглядит как «ещё по-русски»,
 * а не как `nav.admin.dashboard` в интерфейсе.
 */
export function translate(locale: Locale, key: string): string {
  return resolve(RESOURCES[locale], key) ?? resolve(RESOURCES.ru, key) ?? key;
}
