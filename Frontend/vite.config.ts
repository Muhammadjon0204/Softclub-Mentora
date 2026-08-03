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

export default defineConfig({
  plugins: [react(), stripMockWorker()],
  resolve: {
    // Абсолютный путь от корня проекта — без зависимости от @types/node.
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
