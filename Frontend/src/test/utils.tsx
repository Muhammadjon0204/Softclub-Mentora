import { StrictMode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '../auth/AuthProvider';
import { AppRouter } from '../routes/AppRouter';

/** Показывает текущий маршрут — так проще проверять redirect'ы. */
function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

export interface RenderAppResult extends RenderResult {
  queryClient: QueryClient;
  user: UserEvent;
}

interface RenderAppOptions {
  /** Включает двойное монтирование React 18 — как в dev-сборке приложения. */
  strictMode?: boolean;
}

export function renderApp(initialPath = '/login', options: RenderAppOptions = {}): RenderAppResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <AppRouter />
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const result = render(
    options.strictMode === true ? <StrictMode>{tree}</StrictMode> : tree,
  );

  return { ...result, queryClient, user: userEvent.setup() };
}

export const DEMO_PASSWORD = 'DemoPassword1!';

export const TEST_ACCOUNTS = {
  admin: 'admin@mentortaskflow.test',
  lead: 'lead@mentortaskflow.test',
  mentor: 'mentor@mentortaskflow.test',
  locked: 'locked@mentortaskflow.test',
  invited: 'invited@mentortaskflow.test',
  reuse: 'reuse@mentortaskflow.test',
  // Мультифилиальные сценарии (ТЗ 2.2, раздел 41.3).
  organizationAdmin: 'organization-admin@mentortaskflow.test',
  branchAdminHead: 'branch-admin-head@mentortaskflow.test',
  branchAdminKhujand: 'branch-admin-khujand@mentortaskflow.test',
  leadHead: 'lead-head@mentortaskflow.test',
  leadKhujand: 'lead-khujand@mentortaskflow.test',
  mentorHead: 'mentor-head@mentortaskflow.test',
  mentorKhujand: 'mentor-khujand@mentortaskflow.test',
} as const;

/** Собирает URL всех запросов, ушедших через MSW, пока идёт тест. */
export function trackRequests(server: {
  events: { on: (event: 'request:start', listener: (args: { request: Request }) => void) => void };
}): string[] {
  const urls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    urls.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  return urls;
}
