import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { BrandLogo } from '../../shared/branding/BrandLogo';
import { Tooltip } from '../../shared/ui/Tooltip';
import { useMentorNavBadges } from './useMentorNavBadges';
import { MENTOR_NAV_ITEMS } from './navConfig';

interface MentorSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}

/** Тот же визуальный язык, что `LeadSidebar`/`AdminSidebar` — не новая design-система. */
export function MentorSidebar({ collapsed, onToggleCollapse, variant = 'desktop', onNavigate }: MentorSidebarProps): JSX.Element {
  const badgeByKey = useMentorNavBadges();
  const isCollapsed = variant === 'desktop' && collapsed;

  const collapseLabel = collapsed ? 'Развернуть меню' : 'Свернуть меню';

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className={`relative flex h-16 items-center border-b border-line px-4 ${isCollapsed ? 'justify-center px-2' : ''}`}>
        {isCollapsed ? (
          <Tooltip content="Mentora">
            <NavLink
              to="/mentor/dashboard"
              aria-label="Mentora — перейти к обзору"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <BrandLogo variant="mark" alt="" />
            </NavLink>
          </Tooltip>
        ) : (
          <NavLink
            to="/mentor/dashboard"
            aria-label="Mentora — перейти к обзору"
            className="flex min-w-0 items-center rounded-control-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <BrandLogo variant="full" alt="" />
          </NavLink>
        )}

        {variant === 'desktop' ? (
          <div className="absolute -right-4 top-1/2 z-20 -translate-y-1/2">
            <Tooltip content={collapseLabel}>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapseLabel}
                aria-expanded={!collapsed}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary shadow-surface transition-colors duration-[170ms] hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <nav aria-label="Основная навигация" className="flex-1 overflow-y-auto px-2.5 py-3">
        <ul className="space-y-0.5">
          {MENTOR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const badgeCount = badgeByKey[item.key];

            const link = (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition ${isCollapsed ? 'justify-center px-0' : ''} ${
                    isActive ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                  }`
                }
                end
              >
                <span className="relative flex shrink-0 items-center">
                  <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
                  {isCollapsed && badgeCount > 0 ? (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-brand" />
                  ) : null}
                </span>
                {!isCollapsed ? (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="whitespace-nowrap">{item.label}</span>
                    {badgeCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-brand">
                        {badgeCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </NavLink>
            );

            return <li key={item.key}>{isCollapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}</li>;
          })}
        </ul>
      </nav>
    </div>
  );
}
