import { Tags } from 'lucide-react';

import type { CategoryHealthRow } from '../../api/admin/dashboard';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { HealthPill } from './BranchHealthTable';

interface CategoryHealthTableProps {
  rows: CategoryHealthRow[];
  /** В режиме «Все филиалы» показываем колонку «Филиал» (ТЗ FE-043). */
  showBranchColumn: boolean;
}

const COLOR_DOT: Record<CategoryHealthRow['colorToken'], string> = {
  indigo: 'bg-brand',
  blue: 'bg-chart-blue',
  cyan: 'bg-chart-cyan',
};

export function CategoryHealthTable({ rows, showBranchColumn }: CategoryHealthTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Tags className="h-5 w-5" aria-hidden="true" />}
        title="Категорий пока нет"
        description="Создайте первую категорию, чтобы увидеть сводку по ней здесь."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="h-11 border-b border-divider text-[12px] font-semibold text-ink-muted">
            <th scope="col" className="px-5 font-semibold sm:px-6">
              Категория
            </th>
            {showBranchColumn ? (
              <th scope="col" className="px-3 font-semibold">
                Филиал
              </th>
            ) : null}
            <th scope="col" className="px-3 font-semibold">
              Лид
            </th>
            <th scope="col" className="px-3 font-semibold">
              Менторы
            </th>
            <th scope="col" className="px-3 font-semibold">
              Активные
            </th>
            <th scope="col" className="px-3 font-semibold">
              На проверке
            </th>
            <th scope="col" className="px-3 font-semibold">
              Здоровье
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.categoryId} className="h-14 border-b border-divider last:border-0 hover:bg-surface-hover">
              <td className="px-5 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[row.colorToken]}`} />
                  <span className="font-medium text-ink">{row.categoryName}</span>
                  {!row.isActive ? <Badge tone="neutral">архив</Badge> : null}
                </div>
              </td>
              {showBranchColumn ? (
                <td className="px-3 text-sm text-ink-secondary">{row.branchName}</td>
              ) : null}
              <td className="px-3 text-sm text-ink-secondary">
                {row.leadName ?? <span className="text-warning">нет лида</span>}
              </td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.mentorsCount}</td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.activeAssignments}</td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.pendingReview}</td>
              <td className="px-3">
                <HealthPill value={row.healthPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
