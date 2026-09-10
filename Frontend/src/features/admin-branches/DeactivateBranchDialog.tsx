import { DestructiveConfirmDialog } from '../../shared/overlays';
import { useAuth } from '../../auth/useAuth';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import { useUsersQuery } from '../admin-users/useUsersQuery';
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
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const { users } = useUsersQuery();
  const { categories } = useCategoriesForBranch(branch?.id ?? null, isOrgAdmin);
  const usersCount = branch !== null ? users.filter((user) => user.branchId === branch.id && user.status !== 'Deactivated').length : 0;
  const categoriesCount = branch !== null ? categories.length : 0;

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
