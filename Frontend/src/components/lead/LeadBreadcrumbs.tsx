import { ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { useTranslation } from '../../shared/i18n/useTranslation';
import { LEAD_NAV_ITEMS } from './navConfig';

export function LeadBreadcrumbs(): JSX.Element {
  const location = useLocation();
  const { t } = useTranslation();
  const current = LEAD_NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));

  return (
    <nav aria-label={t('breadcrumbs.ariaLabel')} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
      <span>{t('breadcrumbs.lead')}</span>
      {current !== undefined ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span aria-current="page" className="font-medium text-ink">
            {t(`nav.lead.${current.key}`)}
          </span>
        </>
      ) : null}
    </nav>
  );
}
