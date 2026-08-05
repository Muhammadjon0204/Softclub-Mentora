import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface ActivateCategoryDialogProps {
  category: PreviewCategoryDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export function ActivateCategoryDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: ActivateCategoryDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Активировать направление?"
      description="Направление снова станет доступно для назначения заданий."
      details={
        category !== null && category.leadUserId === null ? (
          <p className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
            После активации у направления по-прежнему не будет руководителя.
          </p>
        ) : undefined
      }
      confirmLabel="Активировать"
      loading={isSubmitting}
      onConfirm={async () => {
        if (category === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}
