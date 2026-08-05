import { Tags } from 'lucide-react';

import type { CategoryHealthRow } from '../../api/admin/dashboard';
import { EmptyState } from '../../shared/ui/EmptyState';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { DashboardRankingRow } from './DashboardRankingRow';
import { formatBranchDisplayName } from './dashboardFormatters';
import { InsightCard } from './InsightCard';

interface TopTeamsCardProps {
  /** «Команда» здесь = Category (направление) внутри конкретного Branch, включая Lead и менторов. */
  categories: CategoryHealthRow[];
  limit?: number;
}

const COLOR_TILE: Record<CategoryHealthRow['colorToken'], string> = {
  indigo: 'bg-brand-soft text-brand',
  blue: 'bg-info-soft text-info',
  cyan: 'bg-[var(--secondary-cyan)]/15 text-[var(--secondary-cyan)]',
};

/**
 * Ранжирование и отображаемое значение — completionRatePct (раздел 17
 * полироли), не healthPct: та метрика тривиально давала 100% у любой
 * категории без единого просроченного задания, отсюда «два одинаковых 100%».
 * Tie-break: approvedCount → onTimeRatePct → стабильное имя категории.
 */
export function TopTeamsCard({ categories, limit = 5 }: TopTeamsCardProps): JSX.Element {
  const ranked = categories
    .filter((c) => c.isActive)
    .slice()
    .sort(
      (a, b) =>
        b.completionRatePct - a.completionRatePct ||
        b.approvedCount - a.approvedCount ||
        b.onTimeRatePct - a.onTimeRatePct ||
        a.categoryName.localeCompare(b.categoryName, 'ru'),
    )
    .slice(0, limit);

  return (
    <InsightCard
      title="Лучшие команды"
      subtitle="По проценту завершения за период"
      footer={<DashboardCardFooterLink to="/admin/categories">Перейти к категориям</DashboardCardFooterLink>}
    >
      {ranked.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<Tags className="h-5 w-5" aria-hidden="true" />}
            title="Недостаточно данных"
            description="Недостаточно данных для сравнения команд."
          />
        </div>
      ) : (
        <ul>
          {ranked.map((team, index) => {
            const branchLabel = formatBranchDisplayName(team.branchName);
            const href = `/admin/categories?categoryId=${encodeURIComponent(team.categoryId)}&branchId=${encodeURIComponent(
              team.branchId,
            )}&category=${encodeURIComponent(team.categoryName)}&branch=${encodeURIComponent(team.branchName)}`;
            return (
              <li key={team.categoryId}>
                <DashboardRankingRow
                  rank={index + 1}
                  icon={
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${COLOR_TILE[team.colorToken]}`} aria-hidden="true">
                      <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  }
                  title={team.categoryName}
                  subtitle={branchLabel}
                  value={`${team.completionRatePct}%`}
                  progress={team.completionRatePct}
                  progressLabel={`${team.completionRatePct}% завершённых заданий из максимальных 100%`}
                  isLeader={index === 0}
                  href={href}
                  ariaLabel={`Открыть команду ${team.categoryName}, ${branchLabel}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </InsightCard>
  );
}
