import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { readPreference, writePreference } from '../../lib/preferenceStorage';

const CHECK_INTERVAL_MS = 5 * 60_000;
const CHUNK_RELOAD_KEY = 'mtf:chunk-reload-at';

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${String(Date.now())}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * Одностраничное приложение не перезагружается само: вкладка, открытая до деплоя,
 * так и работает на старом коде — у кого-то на телефоне неделями. Сборка кладёт
 * рядом `version.json`; здесь его сверяют с версией в памяти и, если вышла новая,
 * предлагают обновиться. А если старая вкладка просит кусок кода, которого после
 * деплоя уже нет, — перезагружаемся сразу, вместо белого экрана.
 */
export function AppUpdateWatcher(): JSX.Element | null {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;

    const check = (): void => {
      void fetchDeployedVersion().then((deployed) => {
        if (deployed !== null && deployed !== CURRENT_VERSION) setAvailable(true);
      });
    };
    const onVisible = (): void => { if (document.visibilityState === 'visible') check(); };

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    check();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    // Vite сообщает, что lazy-чанк не загрузился. Перезагрузка подтянет новую сборку;
    // отметка времени не даёт уйти в цикл, если чанк недоступен по другой причине.
    const onPreloadError = (event: Event): void => {
      const last = Number(readPreference(CHUNK_RELOAD_KEY) ?? '0');
      if (Date.now() - last < 30_000) return;
      event.preventDefault();
      writePreference(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => { window.removeEventListener('vite:preloadError', onPreloadError); };
  }, []);

  return (
    <AnimatePresence>
      {available && !dismissed ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-3 bottom-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-[0_12px_32px_rgba(20,28,58,0.16)] sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">Вышла новая версия RAVAND</p>
            <p className="text-[12px] text-ink-muted">Обновите страницу, чтобы получить исправления</p>
          </div>
          <button
            type="button"
            onClick={() => { window.location.reload(); }}
            className="shrink-0 rounded-control bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-hover"
          >
            Обновить
          </button>
          <button
            type="button"
            aria-label="Позже"
            onClick={() => { setDismissed(true); }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface-hover"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
