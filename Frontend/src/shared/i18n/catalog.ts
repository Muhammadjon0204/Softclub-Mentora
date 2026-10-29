/**
 * Перевод интерфейса «по исходному тексту»: ключ каталога — сама русская строка, ровно та, что
 * написана в коде, значение — перевод. Каталоги (`catalog/en.json`, `catalog/tg.json`) собираются
 * и проверяются `scripts/i18n-extract.mjs`.
 *
 * Строку переводит не вызывающий код, а JSX-рантайм (`jsx/jsx-runtime.ts`): каждый элемент,
 * который рендерит React, проходит через `localizeProps()`. Поэтому переведено всё, что попадает
 * на экран, — включая подписи из модульных констант, тосты и текст из шаблонных строк, — а логика
 * приложения по-прежнему сравнивает и хранит русские значения: перевод живёт только на последнем
 * шаге, в отрисовке. Для русского языка каталог не активен и всё это — одна проверка на `null`.
 *
 * Строка ищется по шагам, от точного к общему:
 *   1. точное совпадение (после схлопывания пробелов, как в JSX);
 *   2. то же без учёта регистра первой буквы — для `label.toLowerCase()` в коде;
 *   3. числа заменены на `{0}`, `{1}` … — для `${n} непрочитанных`;
 *   4. шаблон `Просрочено на {0} {1}` как регулярное выражение — подстановки тоже переводятся;
 *   5. по частям вокруг « · » и « — », если целиком не нашлось.
 * Непереведённая строка остаётся русской — никогда не превращается в ключ или пустоту.
 */

import type { Locale } from './translations';

type Catalog = Record<string, string>;

interface Pattern {
  re: RegExp;
  /** Самый длинный буквальный кусок шаблона — дешёвый фильтр до запуска регулярки. */
  anchor: string;
  /** Номера плейсхолдеров в порядке появления в шаблоне. */
  order: number[];
  value: string;
}

interface Compiled {
  exact: Map<string, string>;
  lower: Map<string, string>;
  patterns: Pattern[];
  /** Уже переведённые строки: таджикский — тоже кириллица, и проп, прошедший через компонент, приходит повторно. */
  outputs: Set<string>;
}

const CYR = /[А-Яа-яЁё]/;
const NUM = /\d+(?:\s\d{3})*(?:[.,]\d+)?/g;
const PLACEHOLDER = /\{(\d+)\}/g;
const SEPARATORS = [' · ', ' — '];
const CACHE_LIMIT = 20_000;

const LOADERS: Record<Exclude<Locale, 'ru'>, () => Promise<Catalog>> = {
  en: () => import('./catalog/en.json').then((m) => m.default as Catalog),
  tg: () => import('./catalog/tg.json').then((m) => m.default as Catalog),
};

const loaded = new Map<Locale, Compiled>();
const pending = new Map<Locale, Promise<void>>();
let active: Compiled | null = null;
let cache = new Map<string, string>();

/** Тот же алгоритм, что в экстракторе: пробелы, неразрывные пробелы и переводы строк — в один пробел. */
export function normalizeKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(catalog: Catalog): Compiled {
  const exact = new Map<string, string>();
  const lower = new Map<string, string>();
  const patterns: Pattern[] = [];
  const outputs = new Set<string>();

  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== 'string' || value.length === 0) continue;
    exact.set(key, value);
    outputs.add(normalizeKey(value));
    if (!lower.has(key.toLowerCase())) lower.set(key.toLowerCase(), value);

    if (!key.includes('{')) continue;
    const literals = key.split(/\{\d+\}/);
    const order = [...key.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
    // Два плейсхолдера подряд без текста между ними нельзя однозначно разобрать.
    if (order.length === 0 || literals.slice(1, -1).some((l) => l.length === 0)) continue;
    const anchor = literals.reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), '');
    if (!CYR.test(anchor)) continue;
    // `.*?`: вставка бывает пустой — «Требует внимания: {0}.{1}» без примечания.
    const body = literals.map(escapeRegExp).join('(.*?)');
    patterns.push({ re: new RegExp(`^${body}$`), anchor, order, value });
  }

  // Длинные шаблоны конкретнее коротких: «Просрочено на {0} {1}» раньше, чем «{0} {1}».
  patterns.sort((a, b) => b.anchor.length - a.anchor.length);
  return { exact, lower, patterns, outputs };
}

function fill(template: string, args: string[]): string {
  return template.replace(PLACEHOLDER, (whole, n: string) => args[Number(n)] ?? whole);
}

function withCaseOf(source: string, translated: string): string {
  const first = source.charAt(0);
  if (first !== first.toUpperCase() && first === first.toLowerCase()) {
    return translated.charAt(0).toLowerCase() + translated.slice(1);
  }
  return translated;
}

function lookupPlain(c: Compiled, key: string): string | undefined {
  const exact = c.exact.get(key);
  if (exact !== undefined) return exact;
  const ci = c.lower.get(key.toLowerCase());
  return ci === undefined ? undefined : withCaseOf(key, ci);
}

function lookup(c: Compiled, key: string, depth: number): string | undefined {
  const plain = lookupPlain(c, key);
  if (plain !== undefined) return plain;

  const numbers: string[] = [];
  const numbered = key.replace(NUM, (m) => {
    numbers.push(m);
    return `{${String(numbers.length - 1)}}`;
  });
  if (numbers.length > 0) {
    const template = lookupPlain(c, numbered);
    if (template !== undefined) return fill(template, numbers);
  }

  if (depth > 1) return undefined;

  // «Через 1 день» подходит и под «Через {0}», и под «Через {0} {1}»: берём первый шаблон,
  // у которого перевелись все кириллические вставки, иначе — первый подошедший.
  let partial: string | undefined;
  for (const p of c.patterns) {
    if (!key.includes(p.anchor)) continue;
    const m = p.re.exec(key);
    if (m === null) continue;
    const args: string[] = [];
    let complete = true;
    p.order.forEach((placeholder, i) => {
      const captured = m[i + 1] ?? '';
      const translated = CYR.test(captured) ? lookup(c, normalizeKey(captured), depth + 1) : captured;
      if (translated === undefined) complete = false;
      args[placeholder] = translated ?? captured;
    });
    if (complete) return fill(p.value, args);
    partial ??= fill(p.value, args);
  }

  for (const sep of SEPARATORS) {
    if (!key.includes(sep)) continue;
    const parts = key.split(sep);
    let changed = false;
    const out = parts.map((part) => {
      if (!CYR.test(part)) return part;
      const t = lookup(c, part, depth + 1);
      if (t === undefined) return part;
      changed = true;
      return t;
    });
    if (changed) return out.join(sep);
  }

  return partial;
}

const reported = new Set<string>();

/** Перевести одну строку на активный язык; без активного каталога (русский) — вернуть как есть. */
export function translateText(input: string): string {
  const c = active;
  if (c === null || !CYR.test(input)) return input;

  const cached = cache.get(input);
  if (cached !== undefined) return cached;

  const key = normalizeKey(input);
  const translated = key.length === 0 ? undefined : c.outputs.has(key) && !c.exact.has(key) ? key : lookup(c, key, 0);
  let result = input;
  if (translated !== undefined) {
    const lead = /^\s*/.exec(input)?.[0] ?? '';
    const trail = /\s*$/.exec(input)?.[0] ?? '';
    result = `${lead}${translated}${trail}`;
  } else if (import.meta.env.DEV && !reported.has(key)) {
    reported.add(key);
    (globalThis as { __i18nMissing?: Set<string> }).__i18nMissing ??= new Set();
    (globalThis as { __i18nMissing?: Set<string> }).__i18nMissing?.add(key);
  }

  if (cache.size >= CACHE_LIMIT) cache = new Map();
  cache.set(input, result);
  return result;
}

/** Для мест, где текст уходит мимо JSX: `window.confirm`, CSV, `document.title`. */
export const tr = translateText;

/** Загружает каталог языка заранее — переключение не должно показывать полупереведённый экран. */
export function ensureCatalog(locale: Locale): Promise<void> {
  if (locale === 'ru' || loaded.has(locale)) return Promise.resolve();
  let p = pending.get(locale);
  if (p === undefined) {
    p = LOADERS[locale]()
      .then((catalog) => {
        loaded.set(locale, compile(catalog));
      })
      .finally(() => {
        pending.delete(locale);
      });
    pending.set(locale, p);
  }
  return p;
}

/** Делает язык активным для `translateText`. Каталог должен быть уже загружен (`ensureCatalog`). */
export function activateCatalog(locale: Locale): void {
  active = locale === 'ru' ? null : (loaded.get(locale) ?? null);
  cache = new Map();
}

export function isCatalogActive(): boolean {
  return active !== null;
}

/**
 * Пропсы DOM-элементов, которые никогда не являются текстом для человека: значения полей, адреса,
 * идентификаторы, классы. Всё остальное с кириллицей у DOM-элемента — подпись (`title`,
 * `placeholder`, `aria-label`, `alt`…).
 */
const DOM_SKIP = new Set([
  'value', 'defaultValue', 'href', 'to', 'src', 'srcSet', 'className', 'id', 'htmlFor', 'type', 'role',
  'name', 'pattern', 'accept', 'autoComplete', 'inputMode', 'lang', 'dir', 'target', 'rel', 'download',
  'form', 'method', 'action', 'data-testid',
]);

/**
 * У компонентов (не DOM) переводятся только явно «текстовые» пропсы: остальные строковые пропсы
 * компонент может использовать как ключ (`tone`, `status`, `kind`), и перевод сломал бы ему логику.
 * Текст, который компонент отдаёт дальше в DOM как содержимое, переведётся там же — этот список
 * нужен для того, что уходит в атрибуты или в сторонние компоненты (Recharts, react-router).
 */
const COMPONENT_TEXT_PROPS = new Set([
  'title', 'label', 'placeholder', 'aria-label', 'ariaLabel', 'alt', 'description', 'subtitle', 'hint',
  'tooltip', 'content', 'emptyText', 'emptyTitle', 'emptyDescription', 'confirmLabel', 'cancelLabel',
  'submitLabel', 'submittingLabel', 'name', 'caption', 'heading', 'text', 'message', 'helperText',
]);

function localizeChildren(value: unknown): unknown {
  if (typeof value === 'string') return CYR.test(value) ? translateText(value) : value;
  if (!Array.isArray(value)) return value;
  let copy: unknown[] | null = null;
  for (let i = 0; i < value.length; i++) {
    const child: unknown = value[i];
    const next = typeof child === 'string' || Array.isArray(child) ? localizeChildren(child) : child;
    if (next !== child) {
      copy ??= [...value];
      copy[i] = next;
    }
  }
  return copy ?? value;
}

/** Вызывается JSX-рантаймом для каждого создаваемого элемента. */
export function localizeProps<P>(type: unknown, props: P): P {
  if (active === null || props === null || typeof props !== 'object') return props;
  const isDom = typeof type === 'string';
  const source = props as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;

  for (const name in source) {
    const value = source[name];
    let next = value;
    if (name === 'children') {
      next = localizeChildren(value);
    } else if (typeof value === 'string' && (isDom ? !DOM_SKIP.has(name) : COMPONENT_TEXT_PROPS.has(name)) && CYR.test(value)) {
      next = translateText(value);
    }
    if (next !== value) {
      out ??= { ...source };
      out[name] = next;
    }
  }
  return (out ?? props) as P;
}
