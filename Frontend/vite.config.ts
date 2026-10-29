import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `public/mockServiceWorker.js` нужен только dev-режиму: Vite копирует всё
 * из `public/` в сборку как есть, а service worker моков в production —
 * мёртвый груз и лишняя поверхность. Удаляем его после сборки.
 * Проверку отсутствия делает `npm run verify:bundle`.
 */
function stripMockWorker(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();

  return {
    name: 'mtf:strip-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    closeBundle() {
      rmSync(resolve(root, outDir, 'mockServiceWorker.js'), { force: true });
    },
  };
}

/**
 * Номер сборки: sha коммита в CI, иначе время сборки. Вшивается в бандл и кладётся
 * рядом в `version.json` — по их расхождению открытая вкладка узнаёт о деплое.
 */
const BUILD_VERSION = process.env.GITHUB_SHA?.slice(0, 12) ?? process.env.APP_VERSION ?? Date.now().toString(36);

function emitVersion(): Plugin {
  return {
    name: 'mtf:emit-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_VERSION }) });
    },
  };
}

export default defineConfig({
  // Свой JSX-рантайм — обёртка над react/jsx-runtime, переводящая текст интерфейса при рендере
  // (src/shared/i18n/catalog.ts). Только исходники приложения: node_modules собраны со своим.
  plugins: [react({ jsxImportSource: '@ravand/i18n-jsx' }), stripMockWorker(), emitVersion()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(BUILD_VERSION),
  },
  resolve: {
    // Абсолютный путь от корня проекта — без зависимости от @types/node.
    alias: { '@': '/src', '@ravand/i18n-jsx': '/src/shared/i18n/jsx' },
  },
  optimizeDeps: {
    // Иначе dev-оптимизатор принимает рантайм за npm-пакет и пре-бандлит его вместе со своей копией
    // catalog.ts: localeStore активирует каталог в одном экземпляре модуля, а JSX читает другой.
    exclude: ['@ravand/i18n-jsx/jsx-runtime', '@ravand/i18n-jsx/jsx-dev-runtime'],
  },
  server: {
    port: 5173,
    // Proxies the real backend onto this same origin/port for local dev against a real API (as
    // opposed to MSW, which intercepts at the fetch layer and never reaches the network at all, so
    // this proxy is inert whenever VITE_USE_MOCKS=true). Same-origin avoids relying on cross-port
    // cookie handling for the refresh-token/CSRF cookies, which not every HTTP client honors the same
    // way browsers do. Target is fixed to the docker-compose api service's published port (5000);
    // point VITE_API_BASE_URL at a different backend instead of editing this for anything else.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // The realtime hub (/api/v1/realtime) upgrades to a WebSocket.
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Above Testing Library's 5 s asyncUtilTimeout (setup.ts): with the default 5 s a test that waits
    // for a lazily compiled page under a loaded machine died on the test timeout instead.
    testTimeout: 15_000,
    css: false,
    restoreMocks: true,
    // The tests run against the MSW mocks. Set here rather than in .env.test, which .gitignore keeps
    // out of the repository — CI never had it, so mock-dependent tests passed locally and failed there.
    env: { VITE_USE_MOCKS: 'true', VITE_API_BASE_URL: '' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
