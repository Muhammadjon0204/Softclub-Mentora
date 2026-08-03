import { HelpCircle, Menu as MenuIcon, WifiOff } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { BranchContextBadge } from '../../features/branch-context/BranchContextBadge';
import { BranchContextSelector } from '../../features/branch-context/BranchContextSelector';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { IconButton } from '../../shared/ui/Button';
import { AdminBreadcrumbs } from './AdminBreadcrumbs';
import { ProfileMenu } from './ProfileMenu';

interface AdminTopbarProps {
  onOpenMobileSidebar: () => void;
}

/**
 * Светлый topbar (раздел 10 промпта). «Выйти» и «Настройки» живут только
 * внутри `ProfileMenu` — здесь нет отдельной иконки logout (раздел 4 задачи
 * UX-рефактора admin shell).
 */
export function AdminTopbar({ onOpenMobileSidebar }: AdminTopbarProps): JSX.Element {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <IconButton
        label="Открыть меню"
        size="md"
        className="lg:hidden"
        onClick={onOpenMobileSidebar}
      >
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      <div className="hidden min-w-0 flex-1 lg:block">
        <AdminBreadcrumbs />
      </div>
      <div className="min-w-0 flex-1 lg:hidden" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <BranchContextSelector />
        <BranchContextBadge />

        {!isOnline ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-warning-border bg-warning-soft px-2.5 py-1 text-[12px] font-medium text-warning sm:flex">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Нет соединения
          </span>
        ) : null}

        <IconButton label="Справка" size="md" className="hidden sm:inline-flex">
          <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
        </IconButton>

        {user !== null ? <ProfileMenu user={user} /> : null}
      </div>
    </header>
  );
}
