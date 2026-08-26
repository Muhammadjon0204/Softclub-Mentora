import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import type { ChangeCategoryLeadInput, PreviousLeadFate } from './useCategoryActions';
import { useCategoriesQuery } from './useCategoriesQuery';
import type { PreviewCategoryDetails } from './categoryPresentation';

const FATE_OPTIONS: { value: PreviousLeadFate; label: string }[] = [
  { value: 'Mentor', label: 'Оставить Mentor этого направления' },
  { value: 'Transfer', label: 'Перевести в другое направление' },
  { value: 'Deactivate', label: 'Деактивировать доступ' },
];

export interface ChangeCategoryLeadDialogProps {
  category: PreviewCategoryDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (input: ChangeCategoryLeadInput) => Promise<void>;
}

/**
 * Раздел 11 промпта — судьба предыдущего Lead не угадывается автоматически. `reason` для обоих
 * реальных `change-role`/`deactivate` вызовов генерируется автоматически из контекста — единое
 * решение «сменить руководителя» уже объясняет оба шага, отдельно переспрашивать причину для
 * каждого было бы избыточным дублированием одного и того же обоснования (см. `useCategoryActions.changeLead`).
 */
export function ChangeCategoryLeadDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: ChangeCategoryLeadDialogProps): JSX.Element {
  const { users } = useUsersQuery();
  const { categories } = useCategoriesQuery();
  const currentLead = category?.leadUserId !== null && category?.leadUserId !== undefined ? users.find((user) => user.id === category.leadUserId) : undefined;
  const candidates = category !== null ? users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchId === category.branchId) : [];
  const otherCategories = category !== null ? categories.filter((entry) => entry.branchId === category.branchId && entry.id !== category.id) : [];

  const [newLeadId, setNewLeadId] = useState('');
  const [fate, setFate] = useState<PreviousLeadFate>('Mentor');
  const [transferTargetId, setTransferTargetId] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewLeadId('');
    setFate('Mentor');
    setTransferTargetId('');
  }, [open, category?.id]);

  const needsTransferTarget = fate === 'Transfer';
  const newLead = candidates.find((candidate) => candidate.id === newLeadId);
  const transferTarget = otherCategories.find((entry) => entry.id === transferTargetId);
  const confirmDisabled = category === null || newLead === undefined || (needsTransferTarget && transferTarget === undefined);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Сменить руководителя направления"
      icon={<UserCog className="h-[18px] w-[18px]" aria-hidden="true" />}
      confirmLabel="Сменить руководителя"
      loading={isSubmitting}
      confirmDisabled={confirmDisabled}
      onConfirm={async () => {
        if (category === null || newLead === undefined) return;
        await onConfirm({
          newLead: { id: newLead.id, concurrencyToken: newLead.concurrencyToken ?? '', fullName: newLead.fullName },
          previousLead: currentLead !== undefined ? { id: currentLead.id, concurrencyToken: currentLead.concurrencyToken ?? '', fullName: currentLead.fullName } : null,
          previousLeadFate: fate,
          transferTarget: needsTransferTarget && transferTarget !== undefined ? { id: transferTarget.id, branchId: transferTarget.branchId, name: transferTarget.name } : undefined,
        });
        onOpenChange(false);
      }}
      description={
        <>
          Текущий руководитель: <span className="font-medium text-ink">{currentLead?.fullName ?? 'Не назначен'}</span>
          {currentLead !== undefined ? <span className="text-ink-muted"> · {currentLead.email}</span> : null}
        </>
      }
      details={
        <div className="space-y-4">
          <FormField label="Новый руководитель" htmlFor="change-lead-new">
            <SearchSelect
              id="change-lead-new"
              value={newLeadId}
              onValueChange={setNewLeadId}
              placeholder="Выберите пользователя"
              searchPlaceholder="Поиск по имени или email…"
              options={candidates.map((candidate) => ({ value: candidate.id, label: candidate.fullName, description: candidate.email }))}
            />
          </FormField>

          {currentLead !== undefined ? (
            <FormField label="Судьба предыдущего руководителя" htmlFor="change-lead-fate">
              <FormSelect
                id="change-lead-fate"
                value={fate}
                onValueChange={(next) => { setFate(next as PreviousLeadFate); setTransferTargetId(''); }}
                options={FATE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </FormField>
          ) : null}

          {currentLead !== undefined && needsTransferTarget ? (
            <FormField label="Целевое направление" htmlFor="change-lead-target" required error={transferTargetId.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="change-lead-target"
                value={transferTargetId}
                onValueChange={setTransferTargetId}
                placeholder="Выберите направление"
                invalid={transferTargetId.length === 0}
                options={otherCategories.map((entry) => ({ value: entry.id, label: entry.name }))}
              />
            </FormField>
          ) : null}

          <ul className="space-y-1.5 text-[12px] leading-[17px] text-ink-secondary">
            <li>· Новый руководитель получит роль Lead этого направления</li>
            <li>· Активные сессии обоих пользователей будут завершены</li>
            <li>· Исторические записи сохраняются</li>
          </ul>
        </div>
      }
    />
  );
}
