import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/useAuth';
import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import type { ChangeBranchAdminInput, PreviousAdminRoleChoice, PreviewBranchDetails } from './branchPresentation';

const PREVIOUS_ROLE_OPTIONS: { value: PreviousAdminRoleChoice; label: string }[] = [
  { value: 'Lead', label: 'Руководитель направления' },
  { value: 'Mentor', label: 'Ментор' },
  { value: 'Deactivate', label: 'Деактивировать доступ' },
];

export interface ChangeBranchAdminDialogProps {
  branch: PreviewBranchDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (input: ChangeBranchAdminInput) => Promise<void>;
}

/** Раздел 33 промпта — не угадывает автоматически новую роль старого администратора, спрашивает явно. */
export function ChangeBranchAdminDialog({ branch, open, onOpenChange, isSubmitting, onConfirm }: ChangeBranchAdminDialogProps): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const { users } = useUsersQuery();
  const { categories: categoryOptions } = useCategoriesForBranch(branch?.id ?? null, isOrgAdmin);
  const currentAdmin = branch?.adminUserId !== null && branch?.adminUserId !== undefined ? users.find((user) => user.id === branch.adminUserId) : undefined;
  const candidates = users.filter((user) => user.status !== 'Deactivated' && user.role !== 'OrgAdmin' && user.role !== 'BranchAdmin');

  const [newAdminId, setNewAdminId] = useState('');
  const [previousRole, setPreviousRole] = useState<PreviousAdminRoleChoice>('Lead');
  const [previousCategoryId, setPreviousCategoryId] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewAdminId('');
    setPreviousRole('Lead');
    setPreviousCategoryId('');
  }, [open, branch?.id]);

  const needsCategory = previousRole === 'Lead' || previousRole === 'Mentor';
  const newAdmin = candidates.find((candidate) => candidate.id === newAdminId);
  const confirmDisabled = branch === null || newAdmin === undefined || (needsCategory && previousCategoryId.length === 0);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Сменить администратора филиала"
      icon={<UserCog className="h-[18px] w-[18px]" aria-hidden="true" />}
      confirmLabel="Сменить администратора"
      loading={isSubmitting}
      confirmDisabled={confirmDisabled}
      onConfirm={async () => {
        if (branch === null || newAdmin === undefined) return;
        await onConfirm({
          newAdmin: { id: newAdmin.id, concurrencyToken: newAdmin.concurrencyToken ?? '', fullName: newAdmin.fullName },
          previousAdmin:
            currentAdmin !== undefined
              ? { id: currentAdmin.id, concurrencyToken: currentAdmin.concurrencyToken ?? '', fullName: currentAdmin.fullName }
              : null,
          previousAdminRoleChoice: previousRole,
          previousAdminCategoryId: needsCategory ? previousCategoryId : null,
        });
        onOpenChange(false);
      }}
      description={
        <>
          Текущий администратор: <span className="font-medium text-ink">{currentAdmin?.fullName ?? 'Не назначен'}</span>
          {currentAdmin !== undefined ? <span className="text-ink-muted"> · {currentAdmin.email}</span> : null}
        </>
      }
      details={
        <div className="space-y-4">
          <FormField label="Новый администратор" htmlFor="change-admin-new">
            <SearchSelect
              id="change-admin-new"
              value={newAdminId}
              onValueChange={setNewAdminId}
              placeholder="Выберите пользователя"
              searchPlaceholder="Поиск по имени или email…"
              options={candidates.map((candidate) => ({ value: candidate.id, label: candidate.fullName, description: candidate.email }))}
            />
          </FormField>

          {currentAdmin !== undefined ? (
            <FormField label="Роль текущего администратора после смены" htmlFor="change-admin-prev-role">
              <FormSelect
                id="change-admin-prev-role"
                value={previousRole}
                onValueChange={(next) => { setPreviousRole(next as PreviousAdminRoleChoice); setPreviousCategoryId(''); }}
                options={PREVIOUS_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </FormField>
          ) : null}

          {currentAdmin !== undefined && needsCategory ? (
            <FormField label="Направление" htmlFor="change-admin-prev-category" required error={previousCategoryId.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="change-admin-prev-category"
                value={previousCategoryId}
                onValueChange={setPreviousCategoryId}
                placeholder="Выберите направление"
                invalid={previousCategoryId.length === 0}
                options={categoryOptions.map((category) => ({ value: category.id, label: category.name }))}
              />
            </FormField>
          ) : null}

          <ul className="space-y-1.5 text-[12px] leading-[17px] text-ink-secondary">
            <li>· Текущий администратор потеряет Branch Admin scope</li>
            <li>· Новый пользователь получит Branch Admin scope</li>
            <li>· Активные сессии обоих пользователей будут завершены</li>
            <li>· Исторические записи сохраняются</li>
          </ul>
        </div>
      }
    />
  );
}
