import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect, FormTextarea } from '../../shared/ui/FormField';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import { useBranchContext } from '../branch-context/useBranchContext';
import { branchDisplayName } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import type { TransferUserInput } from './useUserActions';

export interface TransferUserDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (input: TransferUserInput) => Promise<void>;
}

const REASON_MIN = 5;
const REASON_MAX = 500;

/** Только Organization Admin (раздел 18 промпта) — видимость решает вызывающий `UserActionMenu`. `reason` — новое обязательное поле (`ChangeBranchRequest.Reason`, 5–500 символов). */
export function TransferUserDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: TransferUserDialogProps): JSX.Element {
  const branchContext = useBranchContext();
  const otherBranches = branchContext.availableBranches.filter((branch) => branch.id !== user?.branchId);
  const [branchId, setBranchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || user === null) return;
    setBranchId(otherBranches[0]?.id ?? '');
    setCategoryId('');
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализируем черновик только при открытии на конкретного пользователя
  }, [open, user?.id]);

  const needsCategory = user?.role === 'Lead' || user?.role === 'Mentor';
  const categoriesForBranch = useCategoriesForBranch(branchId.length > 0 ? branchId : null, true);
  const reasonTrimmed = reason.trim();
  const reasonInvalid = reasonTrimmed.length < REASON_MIN || reasonTrimmed.length > REASON_MAX;
  const confirmDisabled = user === null || branchId.length === 0 || (needsCategory && categoryId.length === 0) || reasonInvalid;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Перевести пользователя"
      icon={<ArrowLeftRight className="h-[18px] w-[18px]" aria-hidden="true" />}
      confirmLabel="Перевести"
      loading={isSubmitting}
      confirmDisabled={confirmDisabled}
      onConfirm={async () => {
        if (user === null || branchId.length === 0) return;
        await onConfirm({ newBranchId: branchId, newCategoryId: needsCategory ? categoryId : null, reason: reasonTrimmed });
        onOpenChange(false);
      }}
      description={
        <>
          <span className="font-medium text-ink">{user?.fullName}</span> · текущий филиал: {user !== null ? branchDisplayName(user.branchName) : ''}
        </>
      }
      details={
        <div className="space-y-4">
          <FormField label="Новый филиал" htmlFor="transfer-branch">
            <FormSelect
              id="transfer-branch"
              value={branchId}
              onValueChange={(next) => {
                setBranchId(next);
                setCategoryId('');
              }}
              options={otherBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </FormField>

          {needsCategory ? (
            <FormField label="Новое направление" htmlFor="transfer-category" required error={categoryId.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="transfer-category"
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder={categoriesForBranch.isPending ? 'Загрузка…' : 'Выберите направление'}
                invalid={categoryId.length === 0}
                options={categoriesForBranch.categories.map((category) => ({ value: category.id, label: category.name }))}
              />
            </FormField>
          ) : null}

          <FormField
            label="Причина перевода"
            htmlFor="transfer-reason"
            required
            hint="От 5 до 500 символов — попадает в журнал аудита"
            error={reason.length > 0 && reasonInvalid ? 'От 5 до 500 символов' : undefined}
          >
            <FormTextarea
              id="transfer-reason"
              value={reason}
              onChange={(event) => { setReason(event.target.value); }}
              invalid={reason.length > 0 && reasonInvalid}
              placeholder="Например: переезд ментора в другой город"
            />
          </FormField>

          <ul className="space-y-1.5 text-[12px] leading-[17px] text-ink-secondary">
            <li>· Текущее направление будет заменено</li>
            <li>· Активные сессии пользователя будут завершены</li>
            <li>· Новые данные будут доступны только в новом филиале</li>
            <li>· Исторические данные остаются в прежнем tenant scope согласно ТЗ</li>
          </ul>
        </div>
      }
    />
  );
}
