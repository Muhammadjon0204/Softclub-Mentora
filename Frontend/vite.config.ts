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
      },
    },
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
