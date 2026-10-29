/**
 * Собирает из исходников каждую кириллическую строку интерфейса — литералы, JSX-текст, шаблонные
 * строки (`${x}` превращается в `{0}`, `{1}` …) — и сверяет с каталогами переводов.
 *
 *   node scripts/i18n-extract.mjs            — отчёт: сколько строк, сколько без перевода
 *   node scripts/i18n-extract.mjs --missing  — печатает непереведённые ключи (JSON) для en и tg
 *   node scripts/i18n-extract.mjs --check    — код выхода 1, если есть непереведённые (для CI)
 *
 * Ключ — сама русская строка в том виде, в каком её увидит пользователь: пробелы схлопнуты так
 * же, как это делает JSX и как это делает `normalizeKey()` в рантайме (`src/shared/i18n/catalog.ts`).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(process.cwd(), 'src');
const CATALOG_DIR = join(ROOT, 'shared', 'i18n', 'catalog');
const CYR = /[А-Яа-яЁё]/;

// Не попадает в интерфейс: тесты, MSW-моки (только dev), сами каталоги переводов и
// key-based словари старого `t('nav.…')`.
const SKIP_DIRS = ['test', join('mocks', 'handlers'), join('shared', 'i18n')];
const SKIP_FILES = /\.test\.(ts|tsx)$|[\\/]mocks[\\/](db|browser|scenarios|persistence|cookies|tokens|server)\.ts$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.includes(rel)) continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILES.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const ENTITIES = { '&nbsp;': ' ', '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&amp;': '&', '&quot;': '"' };

/** Тот же алгоритм, которым Babel/esbuild превращают сырой JSX-текст в строку. */
function cleanJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) lastNonEmpty = i; });
  let out = '';
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^ +/, '');
    if (i !== lines.length - 1) t = t.replace(/ +$/, '');
    if (t) out += i === lastNonEmpty ? t : `${t} `;
  });
  return out.replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);
}

export function normalizeKey(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/** Ключ без кириллицы вне плейсхолдеров («{0} {1}») ничего не переводит и совпал бы с чем угодно. */
function usable(key) {
  return CYR.test(key.replace(/\{\d+\}/g, ''));
}

export function extract() {
  const keys = new Map();
  const add = (raw, file) => {
    const key = normalizeKey(raw);
    if (!key || !usable(key)) return;
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(relative(ROOT, file));
  };

  for (const file of walk(ROOT)) {
    const text = readFileSync(file, 'utf8');
    if (!CYR.test(text)) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    const visit = (node) => {
      if (ts.isJsxText(node)) {
        if (CYR.test(node.text)) add(cleanJsxText(node.text), file);
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (CYR.test(node.text)) add(node.text, file);
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
        if (parts.some((p) => CYR.test(p))) {
          let key = node.head.text;
          node.templateSpans.forEach((span, i) => { key += `{${String(i)}}${span.literal.text}`; });
          add(key, file);
        }
        // Вложенные шаблоны и литералы внутри `${…}` — тоже строки интерфейса.
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return keys;
}

function loadCatalog(locale) {
  const file = join(CATALOG_DIR, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (isMain) {
  const keys = extract();
  const mode = process.argv[2];
  const missing = {};
  for (const locale of ['en', 'tg']) {
    const catalog = loadCatalog(locale);
    missing[locale] = [...keys.keys()].filter((k) => typeof catalog[k] !== 'string' || catalog[k].length === 0);
  }

  if (mode === '--missing') {
    process.stdout.write(`${JSON.stringify(missing, null, 2)}\n`);
  } else if (mode === '--all') {
    const all = {};
    for (const [k, files] of keys) all[k] = [...files];
    process.stdout.write(`${JSON.stringify(all, null, 2)}\n`);
  } else {
    console.log(`i18n: строк интерфейса — ${String(keys.size)}; без перевода: en — ${String(missing.en.length)}, tg — ${String(missing.tg.length)}`);
    if (mode === '--check' && (missing.en.length > 0 || missing.tg.length > 0)) {
      for (const locale of ['en', 'tg']) for (const k of missing[locale].slice(0, 30)) console.error(`  ✗ [${locale}] ${k}`);
      process.exit(1);
    }
  }
}
