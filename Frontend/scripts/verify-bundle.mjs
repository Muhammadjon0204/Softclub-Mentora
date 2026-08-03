/**
 * Проверка production-сборки: в dist не должно быть ничего от dev-контура —
 * ни MSW, ни QA-утилит, ни тестовых учёток и токенов.
 *
 * Запускается автоматически как часть `npm run build`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist');

/** Файлы, которых в production-сборке быть не должно вовсе. */
const FORBIDDEN_FILES = ['mockServiceWorker.js'];

/** Строки, которых не должно быть ни в одном файле сборки. */
const FORBIDDEN_STRINGS = [
  { needle: 'setupWorker', reason: 'точка входа MSW' },
  { needle: 'setupServer', reason: 'точка входа MSW (node)' },
  { needle: 'mockServiceWorker', reason: 'service worker моков' },
  { needle: 'mtfMocks', reason: 'QA-утилиты мок-слоя' },
  { needle: 'mtf:mock-server-state', reason: 'ключ dev-персистентности моков' },
  { needle: 'mentortaskflow.test', reason: 'тестовые email' },
  { needle: 'DemoPassword1!', reason: 'пароль тестовых учёток' },
  { needle: 'reset-valid-token', reason: 'development security token' },
  { needle: 'reset-expired-token', reason: 'development security token' },
  { needle: 'reset-used-token', reason: 'development security token' },
  { needle: 'set-valid-token', reason: 'development security token' },
  { needle: 'set-expired-token', reason: 'development security token' },
  { needle: 'msw/browser', reason: 'импорт MSW' },
  { needle: 'from "msw"', reason: 'импорт MSW' },
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

if (!existsSync(DIST)) {
  console.error('verify-bundle: каталог dist не найден — сначала выполните сборку.');
  process.exit(1);
}

const failures = [];

for (const name of FORBIDDEN_FILES) {
  if (existsSync(join(DIST, name))) {
    failures.push(`лишний файл в сборке: ${name}`);
  }
}

const files = walk(DIST);

for (const file of files) {
  const shortName = relative(DIST, file);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // бинарные ассеты пропускаем
  }

  for (const { needle, reason } of FORBIDDEN_STRINGS) {
    if (content.includes(needle)) {
      failures.push(`${shortName}: найдено «${needle}» (${reason})`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nverify-bundle: production-сборка содержит артефакты dev-контура\n');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(
  `verify-bundle: проверено файлов — ${String(files.length)}, ` +
    `запрещённых маркеров — ${String(FORBIDDEN_STRINGS.length)}, нарушений нет.`,
);
