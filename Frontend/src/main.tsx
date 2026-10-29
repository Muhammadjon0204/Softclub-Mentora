import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';

import { AuthProvider } from './auth/AuthProvider';
import { RealtimeSync } from './realtime/RealtimeSync';
import { AppUpdateWatcher } from './shared/update/AppUpdateWatcher';
import { AppRouter } from './routes/AppRouter';
import { getLocale, prepareLocale, subscribeLocale } from './shared/i18n/localeStore';
import { OverlayProvider, ToastProvider } from './shared/overlays';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Auth-мутации не повторяем автоматически: повтор login «съедает» rate limit,
      // а повтор reset/set-password бьётся об одноразовый токен.
      retry: false,
    },
  },
});

const container = document.getElementById('root');
if (container === null) throw new Error('Не найден элемент #root');

/**
 * Корень подписан на язык и строит всё дерево внутри своего рендера, а не принимает его через
 * `children`: элемент, созданный снаружи, React при перерисовке корня переиспользует и дальше не
 * спускается. Так смена языка перерисовывает всё приложение — JSX-рантайм переводит текст заново —
 * но ничего не размонтирует: открытые drawer'ы, введённое в формы и сессия остаются на месте.
 */
// eslint-disable-next-line react-refresh/only-export-components -- точка входа, fast refresh здесь не нужен
function Root(): JSX.Element {
  useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeSync />
          {/* reducedMotion="user": при prefers-reduced-motion движение гасится, остаётся только opacity. */}
          <MotionConfig reducedMotion="user">
            <OverlayProvider>
              <ToastProvider>
                <AppRouter />
                <AppUpdateWatcher />
              </ToastProvider>
            </OverlayProvider>
          </MotionConfig>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Каталог языка с прошлого визита грузится до первой отрисовки — иначе экран мигнул бы русским.
void prepareLocale().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
});
