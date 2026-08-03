import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { OfflineBanner } from '../components/OfflineBanner';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminTopbar } from '../components/admin/AdminTopbar';
import { BranchProvider } from '../features/branch-context/BranchContext';
import { registerBranchHeaderInterceptor } from '../features/branch-context/branchHeaderInterceptor';

// Саморегистрация интерцептора при первом импорте модуля — тот же приём,
// что и у `refreshCoordinator` (`setRefreshRunner`). `api/client.ts` не меняется.
registerBranchHeaderInterceptor();

/**
 * Единый shell Admin-панели: sidebar + topbar + breadcrumbs + контент (раздел 9
 * промпта). Оба типа Admin (`Organization`/`Branch`) используют один и тот же
 * layout — различие приходит из `BranchContext`, а не из отдельного дерева
 * компонентов.
 */
export function AdminLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BranchProvider>
      <div className="flex h-screen min-w-[360px] overflow-hidden bg-app">
        <OfflineBanner />

        {/* Desktop sidebar. */}
        <aside
          className={`hidden shrink-0 border-r border-line transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-[280px]'}`}
        >
          <AdminSidebar collapsed={collapsed} onToggleCollapse={() => { setCollapsed((v) => !v); }} />
        </aside>

        {/* Mobile drawer. */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => { setMobileOpen(false); }}
              className="absolute inset-0 bg-ink/30 animate-fade-in"
            />
            <div className="relative flex h-full w-[280px] animate-slide-in-left-panel flex-col border-r border-line bg-surface shadow-popover">
              <AdminSidebar
                collapsed={false}
                variant="mobile"
                onToggleCollapse={() => {}}
                onNavigate={() => { setMobileOpen(false); }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar onOpenMobileSidebar={() => { setMobileOpen(true); }} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </BranchProvider>
  );
}
