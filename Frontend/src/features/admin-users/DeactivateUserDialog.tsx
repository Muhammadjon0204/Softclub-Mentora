import { DestructiveConfirmDialog } from '../../shared/overlays';
import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { branchDisplayName, emptyOrValue } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';

export interface DeactivateUserDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

/** DestructiveConfirmDialog — раздел 23 промпта: не удаление, исторические данные сохраняются. */
export function DeactivateUserDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: DeactivateUserDialogProps): JSX.Element {
  return (
    <DestructiveConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Деактивировать пользователя?"
      description="Операция не является удалением — исторические данные пользователя сохраняются."
      confirmLabel="Деактивировать"
      loading={isSubmitting}
      consequences={['Вход будет запрещён', 'Активные сессии завершатся', 'Новые задания не назначаются', 'Исторические данные сохраняются']}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm();
        onOpenChange(false);
      }}
    >
      {user !== null ? (
        <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">ФИО</span>
            <span className="font-medium text-ink">{user.fullName}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Роль</span>
            <span className="font-medium text-ink">{ROLE_LABEL[user.role]}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Филиал</span>
            <span className="font-medium text-ink">{user.role === 'OrgAdmin' ? 'Вся организация' : branchDisplayName(user.branchName)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Направление</span>
            <span className="font-medium text-ink">{emptyOrValue(user.categoryName)}</span>
          </div>
          {user.activeAssignmentsCount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-muted">Активные задания</span>
              <span className="font-medium text-ink">{user.activeAssignmentsCount}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {user !== null && user.activeAssignmentsCount > 0 ? (
        <p className="mt-3 rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
          У пользователя есть активные задания. В production backend может запретить операцию до их переназначения.
        </p>
      ) : null}
    </DestructiveConfirmDialog>
  );
}
