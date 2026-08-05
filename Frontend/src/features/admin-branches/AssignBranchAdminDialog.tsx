import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { branchDisplayName } from '../admin-users/userPresentation';
import { useUsersPreview } from '../admin-users/userPreviewStore';
import type { PreviewBranchDetails } from './branchPresentation';

export interface AssignBranchAdminDialogProps {
  branch: PreviewBranchDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (adminUserId: string) => Promise<void>;
}

/** ConfirmDialog + select кандидата (раздел 32 промпта) — только Organization Admin. */
export function AssignBranchAdminDialog({ branch, open, onOpenChange, isSubmitting, onConfirm }: AssignBranchAdminDialogProps): JSX.Element {
  const users = useUsersPreview();
  const candidates = users.filter((user) => user.status !== 'Deactivated' && user.role !== 'OrgAdmin' && user.role !== 'BranchAdmin');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open) setSelectedId('');
  }, [open, branch?.id]);

  const selected = candidates.find((candidate) => candidate.id === selectedId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Назначить администратора филиала"
      icon={<UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />}
      description={<>Филиал: <span className="font-medium text-ink">{branch?.name}</span></>}
      confirmLabel="Назначить"
      loading={isSubmitting}
      confirmDisabled={branch === null || selectedId.length === 0}
      onConfirm={async () => {
        if (branch === null || selectedId.length === 0) return;
        await onConfirm(selectedId);
        onOpenChange(false);
      }}
      details={
        <div className="space-y-4">
          <FormField label="Пользователь" htmlFor="assign-admin-user">
            <FormSelect id="assign-admin-user" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); }}>
              <option value="">Выберите пользователя</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.email}</option>
              ))}
            </FormSelect>
          </FormField>

          {selected !== undefined ? (
            <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">ФИО</span><span className="font-medium text-ink">{selected.fullName}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Текущая роль</span><span className="font-medium text-ink">{ROLE_LABEL[selected.role]}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Текущий филиал</span><span className="font-medium text-ink">{branchDisplayName(selected.branchName)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Новая роль</span><span className="font-medium text-ink">Администратор филиала</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Новый филиал</span><span className="font-medium text-ink">{branch?.name}</span></div>
            </div>
          ) : null}

          <div className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
            Роль и область доступа пользователя изменятся. Активные сессии будут завершены.
          </div>
        </div>
      }
    />
  );
}
