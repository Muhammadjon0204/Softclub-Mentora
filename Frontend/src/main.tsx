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

const container = document.getElementById('root');
if (container === null) throw new Error('Не найден элемент #root');

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
