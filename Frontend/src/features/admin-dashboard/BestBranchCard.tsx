import { Award, Building2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { BestBranchInsight } from '../../api/admin/dashboard';
import { Tooltip } from '../../shared/ui/Tooltip';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { formatBranchDisplayName } from './dashboardFormatters';
import { InsightCard } from './InsightCard';

interface BestBranchCardProps {
  insight: BestBranchInsight;
}

const SCORE_TOOLTIP = 'Preview-индекс: завершение, соблюдение сроков и одобрение с первой попытки. Не официальный продуктовый KPI.';

/**
 * «Лучший филиал» (все филиалы) vs «Результат филиала» (выбран один филиал /
 * Branch Admin) — раздел 12 полироли. Убран award-template с центрированной
 * трофей-иконкой на всю карточку: теперь компактная summary-строка сверху +
 * тонкий progress bar + 3-колоночный mini-grid, без пустого пространства.
 */
export function BestBranchCard({ insight }: BestBranchCardProps): JSX.Element {
  const isRanking = insight.mode === 'best-of-all';
  const href = `/admin/branches?branchId=${encodeURIComponent(insight.branchId)}`;

  return (
    <InsightCard
      title={isRanking ? 'Лучший филиал' : 'Результат филиала'}
      subtitle={isRanking ? 'По активности и результатам' : 'Показатели текущего филиала'}
      footer={<DashboardCardFooterLink to={href}>Перейти к филиалу</DashboardCardFooterLink>}
    >
      <Link
        to={href}
        aria-label={`Открыть филиал ${formatBranchDisplayName(insight.branchName)}`}
        className="group -mx-1 flex flex-col gap-2.5 rounded-[10px] px-1 py-1 no-underline transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] ${
                isRanking ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand'
              }`}
              aria-hidden="true"
            >
              {isRanking ? <Award className="h-[17px] w-[17px]" /> : <Building2 className="h-[17px] w-[17px]" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{formatBranchDisplayName(insight.branchName)}</p>
              <p className="text-[11.5px] text-ink-muted">{isRanking ? 'Лидер периода' : 'Текущий филиал'}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-bold leading-6 tabular-nums text-ink">{insight.performanceScore}</p>
            <p className="text-[11px] text-ink-muted">из 100</p>
          </div>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand transition-[width] duration-[180ms] motion-reduce:transition-none" style={{ width: `${insight.performanceScore}%` }} />
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-divider pt-3">
        <MiniMetric label="Активные" value={insight.activeAssignments} />
        <MiniMetric label="Одобрено" value={insight.approvedCount} />
        <MiniMetric label="Менторы" value={insight.mentorsCount} />
      </div>

      <div className="mt-2.5">
        <Tooltip content={SCORE_TOOLTIP}>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <HelpCircle className="h-3 w-3" aria-hidden="true" />
            Индекс эффективности — preview-показатель
          </span>
        </Tooltip>
      </div>
    </InsightCard>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[8px] bg-surface-muted py-2">
      <span className="text-[15px] font-bold tabular-nums text-ink">{value}</span>
      <span className="text-[10.5px] text-ink-muted">{label}</span>
    </div>
  );
}
