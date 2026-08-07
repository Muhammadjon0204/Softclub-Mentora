import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';
import { BrandLogo } from '../../shared/branding/BrandLogo';
import { Tooltip } from '../../shared/ui/Tooltip';
import { ADMIN_NAV_ITEMS } from './navConfig';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** На мобильном сайдбар всегда развёрнут внутри drawer — переключатель не нужен. */
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}

/**
 * Светлый, «тихий» sidebar (раздел 9 промпта): активный пункт — мягкий
 * indigo-фон без яркой вертикальной полосы, а не тёмная панель. Пункты без
 * готовой страницы этого этапа рендерятся как неинтерактивные строки с
 * пометкой «Скоро» — они видимы (нужно для проверки видимости «Филиалы»),
 * но не фокусируемы и никуда не ведут.
 */
export function AdminSidebar({
  collapsed,
  onToggleCollapse,
  variant = 'desktop',
  onNavigate,
}: AdminSidebarProps): JSX.Element {
  const { user } = useAuth();
  const isOrgAdmin = user?.role === 'Admin' && user.adminScope === 'Organization';
  const isCollapsed = variant === 'desktop' && collapsed;

  const items = ADMIN_NAV_ITEMS.filter((item) => item.organizationAdminOnly !== true || isOrgAdmin);

  const collapseLabel = collapsed ? 'Развернуть меню' : 'Свернуть меню';

  return (
    <div className="flex h-full flex-col bg-surface">
      <div
        className={`relative flex h-16 items-center border-b border-line px-4 ${isCollapsed ? 'justify-center px-2' : ''}`}
      >
        {isCollapsed ? (
          <Tooltip content="Mentora">
            <NavLink
              to="/admin/dashboard"
              aria-label="Mentora — перейти к обзору"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <BrandLogo variant="mark" alt="" />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink
            to="/admin/dashboard"
            aria-label="Mentora — перейти к обзору"
            className="flex min-w-0 items-center rounded-control-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <BrandLogo variant="full" alt="" />
          </NavLink>
        )}

        {variant === 'desktop' ? (
          <div className="absolute -right-4 top-1/2 z-20 -translate-y-1/2">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary shadow-surface transition-colors duration-[170ms] hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <nav aria-label="Основная навигация" className="flex-1 overflow-y-auto px-2.5 py-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            if (!item.implemented) {
              const row = (
                <div
                  key={item.key}
                  aria-disabled="true"
                  className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-ink-disabled ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className="h-[19px] w-[19px] shrink-0" />
                  {!isCollapsed ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="whitespace-nowrap text-sm">{item.label}</span>
                      <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-disabled">
                        Скоро
                      </span>
                    </span>
                  ) : null}
                </div>
              );
              return isCollapsed ? (
                <li key={item.key}>
                  <Tooltip content={`${item.label} — скоро`}>{row}</Tooltip>
                </li>
              ) : (
                <li key={item.key}>{row}</li>
              );
            }

            const link = (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition ${isCollapsed ? 'justify-center px-0' : ''} ${
                    isActive
                      ? 'bg-brand-soft text-brand'
                      : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                  }`
                }
                end
              >
                <Icon className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
                {!isCollapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
              </NavLink>
            );

            return (
              <li key={item.key}>{isCollapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}</li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
