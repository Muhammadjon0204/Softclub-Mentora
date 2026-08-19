import { HelpCircle, Menu as MenuIcon, WifiOff } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ProfileMenu } from '../admin/ProfileMenu';
import { IconButton } from '../../shared/ui/Button';
import { MentorBreadcrumbs } from './MentorBreadcrumbs';
import { MentorWorkspaceBadge } from './MentorWorkspaceBadge';

interface MentorTopbarProps {
  onOpenMobileSidebar: () => void;
}

/**
 * Аналог `LeadTopbar`: read-only `MentorWorkspaceBadge` вместо branch-селектора
 * (Mentor не переключает ни Branch, ни Category). `ProfileMenu` переиспользуется
 * как есть — уже role-aware для Mentor.
 */
export function MentorTopbar({ onOpenMobileSidebar }: MentorTopbarProps): JSX.Element {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <IconButton label="Открыть меню" size="md" className="lg:hidden" onClick={onOpenMobileSidebar}>
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      <div className="hidden min-w-0 flex-1 lg:block">
        <MentorBreadcrumbs />
      </div>
      <div className="min-w-0 flex-1 lg:hidden" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <MentorWorkspaceBadge />

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
