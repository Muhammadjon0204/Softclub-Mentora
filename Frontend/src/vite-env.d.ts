/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Базовый URL API без версии: пути эндпоинтов уже содержат `/api/v1/...`.
   * Пустая строка = same-origin (dev + MSW).
   */
  readonly VITE_API_BASE_URL?: string;
  /** Номер сборки — см. `emitVersion` в vite.config.ts. */
  readonly VITE_APP_VERSION?: string;
  /** `'true'` — регистрируем MSW worker. Любое другое значение — реальная сеть. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
