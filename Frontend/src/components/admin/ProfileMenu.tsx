import { Building2, ChevronDown, LogOut, Settings, User } from 'lucide-react';

import type { AuthUser } from '../../api/auth';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { Popover } from '../../shared/ui/Popover';
import { ProfileMenuItem } from './ProfileMenuItem';

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  Admin: 'Администратор',
  Lead: 'Руководитель направления',
  Mentor: 'Ментор',
};

/** Один компактный scope-badge вместо двух отдельных («Администратор» + «Организация»). */
function scopeLabelOf(user: AuthUser): string {
  if (user.role === 'Admin') {
    if (user.adminScope === 'Organization') return 'Администратор организации';
    if (user.adminScope === 'Branch') return 'Администратор филиала';
    return ROLE_LABEL.Admin;
  }
  return ROLE_LABEL[user.role];
}

/**
 * Профильное меню. `fullName` рендерится прямо на triggering-кнопке как обычный
 * видимый текст — не внутри закрытого дропдауна: регрессионные тесты Auth
 * (`screen.findByText('Азиза Раимова')`) проверяют это сразу после логина.
 *
 * Настройки и Выйти живут только здесь — не дублируются в sidebar/topbar
 * (раздел 3–4 задачи ребрендинга UX).
 */
export function ProfileMenu({ user }: { user: AuthUser }): JSX.Element {
  const { logout } = useAuth();
  const { isAllBranches, selectedBranchId, availableBranches } = useBranchContext();

  const scopeLabel = scopeLabelOf(user);
  const isOrgAdmin = user.role === 'Admin' && user.adminScope === 'Organization';
  const organizationContextLine = isOrgAdmin
    ? isAllBranches
      ? 'Все филиалы'
      : (availableBranches.find((branch) => branch.id === selectedBranchId)?.name ?? 'Филиал выбран')
    : (user.branch?.name ?? '—');

  return (
    <Popover
      align="right"
      panelClassName="w-80 rounded-card p-3 shadow-[0_12px_32px_rgba(20,28,58,0.12),0_2px_8px_rgba(20,28,58,0.06)]"
      trigger={({ onClick, ref, isOpen }) => (
        <button
          type="button"
          ref={ref}
          onClick={onClick}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Открыть меню профиля"
          className={`flex h-12 items-center gap-2.5 rounded-dropdown border px-2.5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            isOpen ? 'border-brand/30 bg-brand-soft' : 'border-transparent hover:bg-surface-hover'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">
            {initialsOf(user.fullName)}
          </span>
          <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
            <span className="max-w-[150px] truncate text-[13px] font-semibold leading-tight text-ink">
              {user.fullName}
            </span>
            <span className="hidden truncate text-[12px] leading-tight text-ink-secondary lg:block">
              {scopeLabel}
            </span>
          </span>
          <ChevronDown
            className={`hidden h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 sm:block ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {(close) => (
        <div data-testid="profile-menu-panel" className="flex flex-col gap-2.5">
          {/* 5.1 — заголовок профиля. */}
          <div className="flex items-start gap-3 px-1 pt-0.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand">
              {initialsOf(user.fullName)}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
              <p className="truncate text-[12.5px] text-ink-muted">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium leading-4 text-brand">
                {scopeLabel}
              </span>
            </div>
          </div>

          {/* 5.2 — контекст организации/филиала, без технических ID. */}
          <div className="flex items-center gap-2.5 rounded-control bg-surface-muted px-3 py-3">
            <Building2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{user.organization.name}</p>
              <p className="truncate text-[12px] text-ink-secondary">{organizationContextLine}</p>
            </div>
          </div>

          {/* 5.3 — действия. */}
          <div role="menu" aria-label="Действия профиля" className="flex flex-col gap-0.5">
            <ProfileMenuItem icon={<User className="h-full w-full" aria-hidden="true" />} to="/profile" onClick={close}>
              Профиль
            </ProfileMenuItem>
            {user.role === 'Admin' ? (
              <ProfileMenuItem
                icon={<Settings className="h-full w-full" aria-hidden="true" />}
                to="/admin/settings"
                onClick={close}
              >
                Настройки
              </ProfileMenuItem>
            ) : null}

            <div role="separator" aria-orientation="horizontal" className="my-0.5 border-t border-divider" />

            <ProfileMenuItem
              icon={<LogOut className="h-full w-full" aria-hidden="true" />}
              destructive
              onClick={() => {
                close();
                void logout();
              }}
            >
              Выйти
            </ProfileMenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}
