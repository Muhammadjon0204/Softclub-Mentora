import { Tags } from 'lucide-react';

import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { branchDisplayName, CATEGORY_COLOR_TILE, emptyOrValue } from './categoryPresentation';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface CategoryOverviewSectionProps {
  category: PreviewCategoryDetails;
  canManage: boolean;
  onAssignLead: () => void;
}

/** Компактный metric grid, без Dashboard внутри Drawer (раздел 6 промпта). */
export function CategoryOverviewSection({ category, canManage, onAssignLead }: CategoryOverviewSectionProps): JSX.Element {
  const metrics = [
    { label: 'Активные менторы', value: category.mentorsCount },
    { label: 'Активные задания', value: category.activeAssignments },
    { label: 'Ожидают проверки', value: category.pendingReview },
    { label: 'Завершены за период', value: category.completedThisPeriod },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5 rounded-control border border-line bg-surface-muted p-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-control ${CATEGORY_COLOR_TILE[category.colorToken]}`}>
          <Tags className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{category.name}</p>
          <p className="truncate text-[12.5px] text-ink-muted">{branchDisplayName(category.branchName)}</p>
        </div>
      </div>

      {category.description !== null ? <p className="text-[13px] leading-[20px] text-ink-secondary">{category.description}</p> : null}

      <dl className="divide-y divide-divider px-0.5">
        <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
          <span className="text-ink-muted">Статус</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${category.isActive ? 'text-success' : 'text-ink-muted'}`}>
            <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${category.isActive ? 'bg-success' : 'bg-ink-disabled'}`} />
            {category.isActive ? 'Активно' : 'Неактивно'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
          <span className="text-ink-muted">Дата создания</span>
          <span className="font-medium text-ink">{category.createdLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
          <span className="text-ink-muted">Руководитель</span>
          <span className="font-medium text-ink">{emptyOrValue(category.leadName)}</span>
        </div>
      </dl>

      {category.leadUserId === null ? (
        <EmptyState
          icon={<Tags className="h-5 w-5" aria-hidden="true" />}
          title="Руководитель направления не назначен"
          description="Назначьте пользователя, чтобы он мог управлять этим направлением."
          action={canManage ? <Button variant="primary" size="sm" onClick={onAssignLead}>Назначить руководителя</Button> : undefined}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-control border border-line bg-surface p-3.5">
            <p className="text-[19px] font-bold tabular-nums text-ink">{metric.value}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-muted">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
