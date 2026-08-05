import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './auth/AuthProvider';
import { AppRouter } from './routes/AppRouter';
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

/**
 * MSW стартует только в dev при VITE_USE_MOCKS=true.
 * При любом другом значении bundle моков даже не загружается — сборщик
 * вырезает динамический импорт вместе с недостижимой веткой.
 */
async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS !== 'true') return;

  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const container = document.getElementById('root');
if (container === null) throw new Error('Не найден элемент #root');

// Рендер только после старта worker'а: иначе первый bootstrap-refresh
// успел бы уйти в реальную сеть мимо моков.
void enableMocking().then(() => {
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <OverlayProvider>
              <ToastProvider>
                <AppRouter />
              </ToastProvider>
            </OverlayProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
});
