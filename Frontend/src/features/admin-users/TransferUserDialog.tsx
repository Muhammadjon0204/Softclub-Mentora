import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';
import { activeCategoriesForBranch, branchDisplayName } from './userPresentation';
import type { PreviewUserDetails } from './userPresentation';
import type { TransferUserInput } from './userPreviewStore';

export interface TransferUserDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onConfirm: (input: TransferUserInput) => Promise<void>;
}

/** Только Organization Admin (раздел 18 промпта) — видимость решает вызывающий `UserActionMenu`. */
export function TransferUserDialog({ user, open, onOpenChange, isSubmitting, onConfirm }: TransferUserDialogProps): JSX.Element {
  const [branchName, setBranchName] = useState('');
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    if (!open || user === null) return;
    const otherBranches = BRANCH_DIRECTORY.filter((branch) => branch.rawName !== user.branchName);
    setBranchName(otherBranches[0]?.rawName ?? user.branchName);
    setCategoryName('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализируем черновик только при открытии на конкретного пользователя
  }, [open, user?.id]);

  const needsCategory = user?.role === 'Lead' || user?.role === 'Mentor';
  const categoryOptions = activeCategoriesForBranch(branchName);
  const confirmDisabled = user === null || (needsCategory && categoryName.length === 0);

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
        if (user === null) return;
        await onConfirm({ branchName, categoryName: needsCategory ? categoryName : null });
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
              value={branchName}
              onValueChange={(next) => {
                setBranchName(next);
                setCategoryName('');
              }}
              options={BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName }))}
            />
          </FormField>

          {needsCategory ? (
            <FormField label="Новое направление" htmlFor="transfer-category" required error={categoryName.length === 0 ? 'Выберите направление' : undefined}>
              <FormSelect
                id="transfer-category"
                value={categoryName}
                onValueChange={setCategoryName}
                placeholder="Выберите направление"
                invalid={categoryName.length === 0}
                options={categoryOptions.map((category) => ({ value: category.name, label: category.name }))}
              />
            </FormField>
          ) : null}

          <ul className="space-y-1.5 text-[12px] leading-[17px] text-ink-secondary">
            <li>· Текущее направление будет заменено</li>
            <li>· Активные сессии пользователя будут завершены</li>
            <li>· Новые данные будут доступны только в новом филиале</li>
            <li>· Исторические данные остаются в прежнем tenant scope согласно ТЗ</li>
          </ul>

          {user !== null && user.activeAssignmentsCount > 0 ? (
            <div className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12px] leading-[17px] text-warning">
              У пользователя есть {user.activeAssignmentsCount} активных заданий. Перед production-подключением backend должен проверить их состояние.
            </div>
          ) : null}
        </div>
      }
    />
  );
}
