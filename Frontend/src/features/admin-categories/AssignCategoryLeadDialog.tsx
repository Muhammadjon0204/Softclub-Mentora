import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ROLE_LABEL } from '../../mocks/ui-preview/users.preview';
import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField } from '../../shared/ui/FormField';
import { branchDisplayName } from '../admin-users/userPresentation';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import type { LeadCandidateRef } from './useCategoryActions';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface AssignCategoryLeadDialogProps {
  category: PreviewCategoryDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (lead: LeadCandidateRef) => Promise<void>;
}

/**
 * ConfirmDialog + select кандидата (раздел 11 промпта). `reason` для `POST /users/{id}/change-role`
 * генерируется автоматически из контекста этого действия (не переспрашивается у админа — единственное
 * решение уже объяснено выбором «Назначить руководителя», см. `useCategoryActions.assignLead`).
 */
export function AssignCategoryLeadDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: AssignCategoryLeadDialogProps): JSX.Element {
  const { users } = useUsersQuery();
  const candidates = category !== null ? users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchId === category.branchId) : [];
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
      confirmDisabled={category === null || selected === undefined}
      onConfirm={async () => {
        if (category === null || selected === undefined) return;
        await onConfirm({ id: selected.id, concurrencyToken: selected.concurrencyToken ?? '', fullName: selected.fullName });
        onOpenChange(false);
      }}
      details={
        <div className="space-y-4">
          <FormField label="Пользователь" htmlFor="assign-lead-user">
            <SearchSelect
              id="assign-lead-user"
              value={selectedId}
              onValueChange={setSelectedId}
              placeholder="Выберите пользователя"
              searchPlaceholder="Поиск по имени или email…"
              options={candidates.map((candidate) => ({ value: candidate.id, label: candidate.fullName, description: candidate.email }))}
            />
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
