import { UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
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
            <FormSelect id="change-lead-new" value={newLeadId} onChange={(event) => { setNewLeadId(event.target.value); }}>
              <option value="">Выберите пользователя</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.email}</option>
              ))}
            </FormSelect>
          </FormField>

          {currentLead !== undefined ? (
            <FormField label="Судьба предыдущего руководителя" htmlFor="change-lead-fate">
              <FormSelect id="change-lead-fate" value={fate} onChange={(event) => { setFate(event.target.value as PreviousLeadFate); setTransferTargetId(''); }}>
                {FATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </FormField>
          ) : null}

          {currentLead !== undefined && needsTransferTarget ? (
            <FormField label="Целевое направление" htmlFor="change-lead-target" required error={transferTargetId.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect id="change-lead-target" value={transferTargetId} onChange={(event) => { setTransferTargetId(event.target.value); }}>
                <option value="">Выберите направление</option>
                {otherCategories.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </FormSelect>
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
