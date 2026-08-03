import { RefreshCw } from 'lucide-react';

import { Button } from '../../shared/ui/Button';
import { DashboardPeriodSelect } from './DashboardPeriodSelect';
import type { DashboardPeriod } from './dashboardPeriod';

interface DashboardHeaderProps {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Строгий executive-заголовок. Календарный date-range picker убран целиком
 * (раздел 3 полироли) — Dashboard не нуждается в произвольном выборе двух
 * дат, только в грубом аналитическом периоде через `DashboardPeriodSelect`.
 */
export function DashboardHeader({ period, onPeriodChange, onRefresh, isRefreshing }: DashboardHeaderProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-9 tracking-tight text-ink">Обзор</h1>
        <p className="mt-1 text-sm text-ink-muted">Ключевые показатели и активность платформы</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <DashboardPeriodSelect value={period} onChange={onPeriodChange} />
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          Обновить
        </Button>
      </div>
    </div>
  );
}
