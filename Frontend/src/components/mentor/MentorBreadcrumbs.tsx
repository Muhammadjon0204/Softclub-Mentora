import { ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { MENTOR_NAV_ITEMS } from './navConfig';

export function MentorBreadcrumbs(): JSX.Element {
  const location = useLocation();
  const current = MENTOR_NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));

  return (
    <nav aria-label="Хлебные крошки" className="flex items-center gap-1.5 text-[13px] text-ink-muted">
      <span>Панель ментора</span>
      {current !== undefined ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span aria-current="page" className="font-medium text-ink">
            {current.label}
          </span>
        </>
      ) : null}
    </nav>
  );
}
