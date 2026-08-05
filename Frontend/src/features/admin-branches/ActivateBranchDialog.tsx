import { ConfirmDialog } from '../../shared/overlays';
import type { PreviewBranchDetails } from './branchPresentation';

export interface ActivateBranchDialogProps {
  branch: PreviewBranchDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export function ActivateBranchDialog({ branch, open, onOpenChange, isSubmitting, onConfirm }: ActivateBranchDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Активировать филиал?"
      description="Пользователи филиала снова получат доступ согласно своим ролям."
      details={
        branch !== null && branch.adminUserId === null ? (
          <p className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
            После активации у филиала по-прежнему не будет администратора.
          </p>
        ) : undefined
      }
      confirmLabel="Активировать"
      loading={isSubmitting}
      onConfirm={async () => {
        if (branch === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}
