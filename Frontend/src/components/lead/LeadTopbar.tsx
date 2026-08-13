import { HelpCircle, Menu as MenuIcon, WifiOff } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { ProfileMenu } from '../admin/ProfileMenu';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { IconButton } from '../../shared/ui/Button';
import { LeadBreadcrumbs } from './LeadBreadcrumbs';
import { LeadWorkspaceBadge } from './LeadWorkspaceBadge';

interface LeadTopbarProps {
  onOpenMobileSidebar: () => void;
}

/**
 * Аналог `AdminTopbar`, но вместо `BranchContextSelector`/`BranchContextBadge`
 * (те относятся к Branch-уровню изоляции и доступны только Organization/Branch
 * Admin) — read-only `LeadWorkspaceBadge` со вторым уровнем изоляции (Category).
 * `ProfileMenu` переиспользуется как есть — он уже role-aware для Lead.
 */
export function LeadTopbar({ onOpenMobileSidebar }: LeadTopbarProps): JSX.Element {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <IconButton label="Открыть меню" size="md" className="lg:hidden" onClick={onOpenMobileSidebar}>
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      <div className="hidden min-w-0 flex-1 lg:block">
        <LeadBreadcrumbs />
      </div>
      <div className="min-w-0 flex-1 lg:hidden" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LeadWorkspaceBadge />

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
