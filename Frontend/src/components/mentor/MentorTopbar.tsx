import { HelpCircle, Menu as MenuIcon, WifiOff } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ProfileMenu } from '../admin/ProfileMenu';
import { LanguageSwitcher } from '../../shared/i18n/LanguageSwitcher';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { ThemeToggle } from '../../shared/theme/ThemeToggle';
import { IconButton } from '../../shared/ui/Button';
import { MentorBreadcrumbs } from './MentorBreadcrumbs';

interface MentorTopbarProps {
  onOpenMobileSidebar: () => void;
}

/**
 * Аналог `LeadTopbar`: Mentor не переключает ни филиал, ни направление — где он работает,
 * показывает `ProfileMenu`, отдельной плашки в шапке нет.
 */
export function MentorTopbar({ onOpenMobileSidebar }: MentorTopbarProps): JSX.Element {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <IconButton label={t('topbar.openMenu')} size="md" className="lg:hidden" onClick={onOpenMobileSidebar}>
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      <div className="hidden min-w-0 flex-1 lg:block">
        <MentorBreadcrumbs />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {!isOnline ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-warning-border bg-warning-soft px-2.5 py-1 text-[12px] font-medium text-warning sm:flex">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {t('topbar.offline')}
          </span>
        ) : null}

        <LanguageSwitcher />
        <ThemeToggle />

        <IconButton label={t('topbar.help')} size="md" className="hidden sm:inline-flex">
          <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
        </IconButton>

        {user !== null ? <ProfileMenu user={user} /> : null}
      </div>
    </header>
  );
}
