import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { useUsersPreview } from '../admin-users/userPreviewStore';
import type { PreviousLeadFate } from './categoryPreviewStore';
import type { ChangeCategoryLeadInput } from './categoryPreviewStore';
import { useCategoriesPreviewResolved } from './categoryPreviewStore';
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

/** Раздел 11 промпта — судьба предыдущего Lead не угадывается автоматически. */
export function ChangeCategoryLeadDialog({ category, open, onOpenChange, isSubmitting, onConfirm }: ChangeCategoryLeadDialogProps): JSX.Element {
  const users = useUsersPreview();
  const categories = useCategoriesPreviewResolved();
  const currentLead = category?.leadUserId !== null && category?.leadUserId !== undefined ? users.find((user) => user.id === category.leadUserId) : undefined;
  const candidates = category !== null ? users.filter((user) => user.role === 'Mentor' && user.status === 'Active' && user.branchName === category.branchName) : [];
  const otherCategories = category !== null ? categories.filter((entry) => entry.branchName === category.branchName && entry.id !== category.id) : [];

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
  const confirmDisabled = category === null || newLeadId.length === 0 || (needsTransferTarget && transferTargetId.length === 0);

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
        if (category === null || newLeadId.length === 0) return;
        await onConfirm({ newLeadUserId: newLeadId, previousLeadFate: fate, transferTargetCategoryId: needsTransferTarget ? transferTargetId : undefined });
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
