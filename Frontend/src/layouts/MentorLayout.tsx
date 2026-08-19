import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { OfflineBanner } from '../components/OfflineBanner';
import { MentorSidebar } from '../components/mentor/MentorSidebar';
import { MentorTopbar } from '../components/mentor/MentorTopbar';
import { BranchProvider } from '../features/branch-context/BranchContext';
import { registerBranchHeaderInterceptor } from '../features/branch-context/branchHeaderInterceptor';

registerBranchHeaderInterceptor();

/**
 * Mentor-shell: тот же каркас, что `LeadLayout`/`AdminLayout` (sidebar +
 * topbar + контент) — переиспользуем, не изобретаем design-систему заново.
 * `BranchProvider` оборачивает и здесь: для Mentor он read-only инициализируется
 * `user.branch` и нужен `ProfileMenu`, который читает `useBranchContext()`
 * безусловно для всех ролей.
 */
export function MentorLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BranchProvider>
      <div className="flex h-screen min-w-[360px] overflow-hidden bg-app">
        <OfflineBanner />

        <aside
          className={`hidden shrink-0 border-r border-line transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-[280px]'}`}
        >
          <MentorSidebar collapsed={collapsed} onToggleCollapse={() => { setCollapsed((v) => !v); }} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => { setMobileOpen(false); }}
              className="absolute inset-0 bg-ink/30 animate-fade-in"
            />
            <div className="relative flex h-full w-[280px] animate-slide-in-left-panel flex-col border-r border-line bg-surface shadow-popover">
              <MentorSidebar collapsed={false} variant="mobile" onToggleCollapse={() => {}} onNavigate={() => { setMobileOpen(false); }} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <MentorTopbar onOpenMobileSidebar={() => { setMobileOpen(true); }} />
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
