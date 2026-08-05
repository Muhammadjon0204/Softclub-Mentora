import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { activeCategoriesForBranch } from '../admin-users/userPresentation';
import { useUsersPreview } from '../admin-users/userPreviewStore';
import type { PreviousAdminRoleChoice } from './branchPreviewStore';
import type { ChangeBranchAdminInput } from './branchPreviewStore';
import type { PreviewBranchDetails } from './branchPresentation';

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
  const users = useUsersPreview();
  const currentAdmin = branch?.adminUserId !== null && branch?.adminUserId !== undefined ? users.find((user) => user.id === branch.adminUserId) : undefined;
  const candidates = users.filter((user) => user.status !== 'Deactivated' && user.role !== 'OrgAdmin' && user.role !== 'BranchAdmin');

  const [newAdminId, setNewAdminId] = useState('');
  const [previousRole, setPreviousRole] = useState<PreviousAdminRoleChoice>('Lead');
  const [previousCategory, setPreviousCategory] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewAdminId('');
    setPreviousRole('Lead');
    setPreviousCategory('');
  }, [open, branch?.id]);

  const needsCategory = previousRole === 'Lead' || previousRole === 'Mentor';
  const categoryOptions = branch !== null ? activeCategoriesForBranch(branch.name) : [];
  const confirmDisabled = branch === null || newAdminId.length === 0 || (needsCategory && previousCategory.length === 0);

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
        if (branch === null || newAdminId.length === 0) return;
        await onConfirm({ newAdminUserId: newAdminId, previousAdminRoleChoice: previousRole, previousAdminCategoryName: needsCategory ? previousCategory : null });
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
            <FormSelect id="change-admin-new" value={newAdminId} onChange={(event) => { setNewAdminId(event.target.value); }}>
              <option value="">Выберите пользователя</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.email}</option>
              ))}
            </FormSelect>
          </FormField>

          {currentAdmin !== undefined ? (
            <FormField label="Роль текущего администратора после смены" htmlFor="change-admin-prev-role">
              <FormSelect id="change-admin-prev-role" value={previousRole} onChange={(event) => { setPreviousRole(event.target.value as PreviousAdminRoleChoice); setPreviousCategory(''); }}>
                {PREVIOUS_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </FormField>
          ) : null}

          {currentAdmin !== undefined && needsCategory ? (
            <FormField label="Направление" htmlFor="change-admin-prev-category" required error={previousCategory.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect id="change-admin-prev-category" value={previousCategory} onChange={(event) => { setPreviousCategory(event.target.value); }}>
                <option value="">Выберите направление</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </FormSelect>
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
