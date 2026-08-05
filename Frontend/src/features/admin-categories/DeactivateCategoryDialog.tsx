import { DestructiveConfirmDialog } from '../../shared/overlays';
import { emptyOrValue } from './categoryPresentation';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface DeactivateCategoryDialogProps {
  category: PreviewCategoryDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** DestructiveConfirmDialog — раздел 12 промпта. Backend может вернуть 409 `CATEGORY_HAS_ACTIVE_USERS`; preview допускает действие. */
export function DeactivateCategoryDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: DeactivateCategoryDialogProps): JSX.Element {
  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Деактивировать направление?"
      description="Операция не является удалением — исторические данные направления сохраняются."
      confirmLabel="Деактивировать"
      loading={isSubmitting}
      consequences={['Новые задания не создаются', 'Новые операции блокируются', 'Исторические данные сохраняются', 'Существующие записи не удаляются']}
      onConfirm={async () => {
        if (category === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    >
      {category !== null ? (
        <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Направление</span><span className="font-medium text-ink">{category.name}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Руководитель</span><span className="font-medium text-ink">{emptyOrValue(category.leadName)}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Менторы</span><span className="font-medium text-ink">{category.mentorsCount}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Активные задания</span><span className="font-medium text-ink">{category.activeAssignments}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Ожидают проверки</span><span className="font-medium text-ink">{category.pendingReview}</span></div>
        </div>
      ) : null}

      {category !== null && category.activeAssignments > 0 ? (
        <p className="mt-3 rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
          Backend может запретить деактивацию до завершения активных процессов.
        </p>
      ) : null}
    </DestructiveConfirmDialog>
  );
}
