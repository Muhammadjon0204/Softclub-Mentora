import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';
import type { AssignableRoleValue } from './userForm.schema';
import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { accessSummaryFor, activeCategoriesForBranch, assignableRolesFor } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import type { ChangeUserRoleInput } from './userPreviewStore';

export interface ChangeUserRoleDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOrgAdmin: boolean;
  currentBranchRawName: string | null;
  isSubmitting: boolean;
  onConfirm: (input: ChangeUserRoleInput) => Promise<void>;
}

/** ConfirmDialog + селекты (раздел 17 промпта) — небольшой Modal через готовый `details` slot. */
export function ChangeUserRoleDialog({ user, open, onOpenChange, isOrgAdmin, currentBranchRawName, isSubmitting, onConfirm }: ChangeUserRoleDialogProps): JSX.Element {
  const assignableRoles = assignableRolesFor(isOrgAdmin ? 'Organization' : 'Branch');
  const [role, setRole] = useState<AssignableRoleValue>('Mentor');
  const [branchName, setBranchName] = useState('');
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    if (!open || user === null) return;
    setRole(assignableRoles.includes(user.role as AssignableRoleValue) ? (user.role as AssignableRoleValue) : assignableRoles[0]);
    setBranchName(isOrgAdmin ? user.branchName : (currentBranchRawName ?? user.branchName));
    setCategoryName(user.categoryName ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализируем черновик только при открытии на конкретного пользователя
  }, [open, user?.id]);

  const needsCategory = role === 'Lead' || role === 'Mentor';
  const categoryOptions = activeCategoriesForBranch(branchName);
  const confirmDisabled = user === null || (needsCategory && categoryName.length === 0);

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
        await onConfirm({ role, branchName, categoryName: needsCategory ? categoryName : null });
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
                value={branchName}
                onValueChange={(next) => {
                  setBranchName(next);
                  setCategoryName('');
                }}
                options={BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName }))}
              />
            </FormField>
          ) : null}

          {needsCategory ? (
            <FormField label="Направление" htmlFor="change-role-category" required error={categoryName.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="change-role-category"
                value={categoryName}
                onValueChange={setCategoryName}
                placeholder="Выберите направление"
                invalid={categoryName.length === 0}
                options={categoryOptions.map((category) => ({ value: category.name, label: category.name }))}
              />
            </FormField>
          ) : null}

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
