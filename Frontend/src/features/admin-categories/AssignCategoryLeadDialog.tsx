import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { branchDisplayName } from '../admin-users/userPresentation';
import { useUsersPreview } from '../admin-users/userPreviewStore';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface AssignCategoryLeadDialogProps {
  category: PreviewCategoryDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (leadUserId: string) => Promise<void>;
}

/** ConfirmDialog + select кандидата (раздел 11 промпта). */
export function AssignCategoryLeadDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: AssignCategoryLeadDialogProps): JSX.Element {
  const users = useUsersPreview();
  const candidates = category !== null ? users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchName === category.branchName) : [];
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open) setSelectedId('');
  }, [open, category?.id]);

  const selected = candidates.find((candidate) => candidate.id === selectedId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Назначить руководителя направления"
      icon={<UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />}
      description={
        <>
          Направление: <span className="font-medium text-ink">{category?.name}</span>
          {category !== null ? <span className="text-ink-muted"> · {branchDisplayName(category.branchName)}</span> : null}
        </>
      }
      confirmLabel="Назначить"
      loading={isSubmitting}
      confirmDisabled={category === null || selectedId.length === 0}
      onConfirm={async () => {
        if (category === null || selectedId.length === 0) return;
        await onConfirm(selectedId);
        onOpenChange(false);
      }}
      details={
        <div className="space-y-4">
          <FormField label="Пользователь" htmlFor="assign-lead-user">
            <FormSelect id="assign-lead-user" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); }}>
              <option value="">Выберите пользователя</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.email}</option>
              ))}
            </FormSelect>
          </FormField>

          {selected !== undefined ? (
            <div className="space-y-2 rounded-control border border-line bg-surface-muted p-3 text-[12.5px]">
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Текущая роль</span><span className="font-medium text-ink">{ROLE_LABEL[selected.role]}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-ink-muted">Новая роль</span><span className="font-medium text-ink">{ROLE_LABEL.Lead}</span></div>
            </div>
          ) : null}

          <div className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
            Область доступа пользователя изменится. Активные сессии будут завершены.
          </div>
        </div>
      }
    />
  );
}
