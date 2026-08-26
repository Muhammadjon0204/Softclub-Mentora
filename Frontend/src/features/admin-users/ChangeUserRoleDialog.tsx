import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect, FormTextarea } from '../../shared/ui/FormField';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import { useBranchContext } from '../branch-context/useBranchContext';
import type { AssignableRoleValue } from './userForm.schema';
import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { accessSummaryFor, assignableRolesFor } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import type { ChangeUserRoleInput } from './useUserActions';

export interface ChangeUserRoleDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOrgAdmin: boolean;
  isSubmitting: boolean;
  onConfirm: (input: ChangeUserRoleInput) => Promise<void>;
}

const REASON_MIN = 5;
const REASON_MAX = 500;

/**
 * ConfirmDialog + селекты (раздел 17 промпта) — небольшой Modal через готовый `details` slot.
 * `reason` — новое обязательное поле (5–500 символов, `ChangeRoleRequest.Reason` на backend):
 * смена роли — самостоятельное, осознанное решение администратора, требующее реальной причины
 * для аудита, а не формальности (см. финальный отчёт интеграции).
 */
export function ChangeUserRoleDialog({ user, open, onOpenChange, isOrgAdmin, isSubmitting, onConfirm }: ChangeUserRoleDialogProps): JSX.Element {
  const branchContext = useBranchContext();
  const assignableRoles = assignableRolesFor(isOrgAdmin ? 'Organization' : 'Branch');
  const [role, setRole] = useState<AssignableRoleValue>('Mentor');
  const [branchId, setBranchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || user === null) return;
    setRole(assignableRoles.includes(user.role as AssignableRoleValue) ? (user.role as AssignableRoleValue) : assignableRoles[0]);
    setBranchId(isOrgAdmin ? (user.branchId ?? '') : (branchContext.fixedBranch?.id ?? ''));
    setCategoryId(user.categoryId ?? '');
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализируем черновик только при открытии на конкретного пользователя
  }, [open, user?.id]);

  const needsCategory = role === 'Lead' || role === 'Mentor';
  const categoriesForBranch = useCategoriesForBranch(branchId.length > 0 ? branchId : null, isOrgAdmin);
  const reasonTrimmed = reason.trim();
  const reasonInvalid = reasonTrimmed.length < REASON_MIN || reasonTrimmed.length > REASON_MAX;
  const confirmDisabled = user === null || (needsCategory && categoryId.length === 0) || reasonInvalid;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Изменить роль"
      icon={<UserCog className="h-[18px] w-[18px]" aria-hidden="true" />}
      confirmLabel="Изменить роль"
      loading={isSubmitting}
      confirmDisabled={confirmDisabled}
      onConfirm={async () => {
        if (user === null) return;
        await onConfirm({
          role,
          branchId: isOrgAdmin ? (branchId.length > 0 ? branchId : null) : null,
          categoryId: needsCategory ? categoryId : null,
          reason: reasonTrimmed,
        });
        onOpenChange(false);
      }}
      description={
        <>
          <span className="font-medium text-ink">{user?.fullName}</span> · текущая роль: {user !== null ? ROLE_LABEL[user.role] : ''}
        </>
      }
      details={
        <div className="space-y-4">
          <FormField label="Новая роль" htmlFor="change-role-role">
            <FormSelect
              id="change-role-role"
              value={role}
              onValueChange={(next) => { setRole(next as AssignableRoleValue); }}
              options={assignableRoles.map((value) => ({ value, label: ROLE_LABEL[value] }))}
            />
          </FormField>

          {isOrgAdmin ? (
            <FormField label="Филиал" htmlFor="change-role-branch">
              <FormSelect
                id="change-role-branch"
                value={branchId}
                onValueChange={(next) => {
                  setBranchId(next);
                  setCategoryId('');
                }}
                options={branchContext.availableBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
              />
            </FormField>
          ) : null}

          {needsCategory ? (
            <FormField label="Направление" htmlFor="change-role-category" required error={categoryId.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="change-role-category"
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder={categoriesForBranch.isPending ? 'Загрузка…' : 'Выберите направление'}
                invalid={categoryId.length === 0}
                options={categoriesForBranch.categories.map((category) => ({ value: category.id, label: category.name }))}
              />
            </FormField>
          ) : null}

          <FormField
            label="Причина изменения"
            htmlFor="change-role-reason"
            required
            hint="От 5 до 500 символов — попадает в журнал аудита"
            error={reason.length > 0 && reasonInvalid ? 'От 5 до 500 символов' : undefined}
          >
            <FormTextarea
              id="change-role-reason"
              value={reason}
              onChange={(event) => { setReason(event.target.value); }}
              invalid={reason.length > 0 && reasonInvalid}
              placeholder="Например: повышение до руководителя направления по итогам ревью"
            />
          </FormField>

          <div className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
            После изменения роли активные сессии пользователя будут завершены.
          </div>

          {role !== undefined ? (
            <ul className="space-y-1.5 border-t border-divider pt-3">
              {accessSummaryFor(role).map((line) => (
                <li key={line} className="text-[12px] text-ink-muted">
                  · {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      }
    />
  );
}
