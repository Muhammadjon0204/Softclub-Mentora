/**
 * Локаль для `Intl` и `toLocale*String` — по текущему языку интерфейса, а не захардкоженный
 * `'ru-RU'`: названия месяцев, дней недели и «2 дня назад» из `Intl` иначе остались бы русскими
 * в английском интерфейсе — JSX-рантайм их не переведёт, это не строки из каталога.
 *
 * Форматтеры кэшируются по (язык, опции): `new Intl.DateTimeFormat` не дешёвый, а вызывается
 * в рендере списков. Модульные константы вида `const DATE = new Intl.DateTimeFormat(…)` заменены
 * на `lazyDateTimeFormat(…)` — тот же интерфейс, но язык берётся в момент вызова, а не импорта.
 */
import { getLocale } from './localeStore';

const TAGS = { ru: 'ru-RU', en: 'en-GB', tg: 'tg-TJ' } as const;

let tajikSupported: boolean | undefined;

export function intlLocale(): string {
  const locale = getLocale();
  if (locale !== 'tg') return TAGS[locale];
  // Не каждая сборка ICU в браузере знает таджикский; без неё Intl молча взял бы английский.
  tajikSupported ??= Intl.DateTimeFormat.supportedLocalesOf(['tg']).length > 0;
  return tajikSupported ? TAGS.tg : TAGS.ru;
}

const dateTimeCache = new Map<string, Intl.DateTimeFormat>();
const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

export function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = intlLocale();
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = dateTimeCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(tag, options);
    dateTimeCache.set(key, formatter);
  }
  return formatter;
}

export function relativeTimeFormat(options: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat {
  const tag = intlLocale();
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = relativeCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.RelativeTimeFormat(tag, options);
    relativeCache.set(key, formatter);
  }
  return formatter;
}

export interface LazyDateTimeFormat {
  format: (date?: Date | number) => string;
  formatToParts: (date?: Date | number) => Intl.DateTimeFormatPart[];
}

export function lazyDateTimeFormat(options: Intl.DateTimeFormatOptions): LazyDateTimeFormat {
  return {
    format: (date) => dateTimeFormat(options).format(date),
    formatToParts: (date) => dateTimeFormat(options).formatToParts(date),
  };
}

export interface LazyRelativeTimeFormat {
  format: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
}

export function lazyRelativeTimeFormat(options: Intl.RelativeTimeFormatOptions): LazyRelativeTimeFormat {
  return { format: (value, unit) => relativeTimeFormat(options).format(value, unit) };
}
