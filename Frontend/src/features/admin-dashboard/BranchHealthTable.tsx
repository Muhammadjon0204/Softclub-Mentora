import { Building2, ChevronRight } from 'lucide-react';

import type { BranchHealthRow } from '../../api/admin/dashboard';
import { ActiveStatusBadge, Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { useBranchContext } from '../branch-context/useBranchContext';

interface BranchHealthTableProps {
  rows: BranchHealthRow[];
}

/**
 * «Состояние филиалов» — видно только Organization Admin в режиме «Все филиалы»
 * (ТЗ 2.2, раздел 38.3). Переход в конкретный филиал выполняется тем же
 * `setSelectedBranch`, которым управляет branch selector, — единая точка входа.
 */
export function BranchHealthTable({ rows }: BranchHealthTableProps): JSX.Element {
  const { setSelectedBranch } = useBranchContext();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
        title="Филиалов пока нет"
        description="Как только появится хотя бы один филиал, здесь будет сводка по каждому."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="h-11 border-b border-divider text-[12px] font-semibold text-ink-muted">
            <th scope="col" className="px-5 font-semibold sm:px-6">
              Филиал
            </th>
            <th scope="col" className="px-3 font-semibold">
              Статус
            </th>
            <th scope="col" className="px-3 font-semibold">
              Категории
            </th>
            <th scope="col" className="px-3 font-semibold">
              Менторы
            </th>
            <th scope="col" className="px-3 font-semibold">
              Активные задания
            </th>
            <th scope="col" className="px-3 font-semibold">
              Ожидают проверки
            </th>
            <th scope="col" className="px-3 font-semibold">
              Здоровье
            </th>
            <th scope="col" className="w-10 px-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.branchId} className="h-14 border-b border-divider last:border-0 hover:bg-surface-hover">
              <td className="px-5 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranch(row.branchId);
                  }}
                  className="flex items-center gap-2 rounded text-left font-medium text-ink hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="truncate">{row.branchName}</span>
                  {row.isHeadOffice ? <Badge tone="brand">Главный офис</Badge> : null}
                  {!row.hasActiveAdmin ? <Badge tone="warning">без Admin</Badge> : null}
                </button>
              </td>
              <td className="px-3">
                <ActiveStatusBadge isActive={row.isActive} />
              </td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.categoriesCount}</td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.mentorsCount}</td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.activeAssignments}</td>
              <td className="px-3 text-sm tabular-nums text-ink-secondary">{row.pendingReview}</td>
              <td className="px-3">
                <HealthPill value={row.healthPct} />
              </td>
              <td className="px-3 text-right">
                <ChevronRight className="h-4 w-4 text-ink-disabled" aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HealthPill({ value }: { value: number }): JSX.Element {
  const tone = value >= 90 ? 'success' : value >= 70 ? 'warning' : 'danger';
  return <Badge tone={tone}>{value}%</Badge>;
}
