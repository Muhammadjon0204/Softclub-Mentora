import { DestructiveConfirmDialog } from '../../shared/overlays';
import { PREVIEW_CATEGORIES } from '../../mocks/ui-preview/categories.preview';
import { useUsersPreview } from '../admin-users/userPreviewStore';
import type { PreviewBranchDetails } from './branchPresentation';

export interface DeactivateBranchDialogProps {
  branch: PreviewBranchDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** DestructiveConfirmDialog — раздел 34 промпта: не удаление, восстановление возможно через активацию. */
export function DeactivateBranchDialog({ branch, open, onOpenChange, isSubmitting, onConfirm }: DeactivateBranchDialogProps): JSX.Element {
  const users = useUsersPreview();
  const usersCount = branch !== null ? users.filter((user) => user.branchName === branch.name && user.status !== 'Deactivated').length : 0;
  const categoriesCount = branch !== null ? PREVIEW_CATEGORIES.filter((category) => category.branchName === branch.name).length : 0;

  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Деактивировать филиал?"
      description="Операция не является удалением — исторические данные филиала сохраняются, восстановление возможно через активацию."
      confirmLabel="Деактивировать филиал"
      loading={isSubmitting}
      consequences={['Вход пользователей филиала будет ограничен', 'Новые операции филиала блокируются', 'Исторические данные сохраняются', 'Филиал не удаляется']}
      onConfirm={async () => {
        if (branch === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    >
      {branch !== null ? (
        <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Филиал</span><span className="font-medium text-ink">{branch.name}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Пользователи</span><span className="font-medium text-ink">{usersCount}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Направления</span><span className="font-medium text-ink">{categoriesCount}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Активные задания</span><span className="font-medium text-ink">{branch.activeAssignments}</span></div>
        </div>
      ) : null}

      {branch !== null && branch.activeAssignments > 0 ? (
        <p className="mt-3 rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
          В production backend может запретить деактивацию, пока активные процессы не будут завершены.
        </p>
      ) : null}
    </DestructiveConfirmDialog>
  );
}
