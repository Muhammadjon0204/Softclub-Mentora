import { useEffect, useState } from 'react';

import { applyServerValidation } from '../../components/auth/applyServerValidation';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { Drawer, UnsavedChangesDialog } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { BranchCreateForm, BranchEditForm } from './BranchForm';
import type { BranchFormSubmitHelpers } from './BranchForm';
import { useBranchActions } from './useBranchActions';
import { useBranchesQuery } from './useBranchesQuery';
import type { BranchCreateFormValues, BranchEditFormValues } from './branchForm.schema';

export type BranchFormDrawerState = { mode: 'create' } | { mode: 'edit'; branchId: string };

const FORM_ID = 'branch-form-drawer';

export interface BranchFormDrawerProps {
  state: BranchFormDrawerState | null;
  onClose: () => void;
}

/** Один Drawer на create/edit — та же infrastructure, что и `UserFormDrawer` (раздел 28/31 промпта). */
export function BranchFormDrawer({ state, onClose }: BranchFormDrawerProps): JSX.Element {
  const { branches } = useBranchesQuery();
  const { createBranch, updateBranch, isSubmitting } = useBranchActions();

  const [dirty, setDirty] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  useEffect(() => {
    setDirty(false);
    setBannerError(null);
    setUnsavedOpen(false);
  }, [state]);

  const open = state !== null;
  const editingBranch = state?.mode === 'edit' ? branches.find((branch) => branch.id === state.branchId) : undefined;

  function requestClose(): void {
    if (isSubmitting) return;
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    onClose();
  }

  async function handleCreateSubmit(
    values: BranchCreateFormValues,
    helpers: BranchFormSubmitHelpers<BranchCreateFormValues>,
  ): Promise<void> {
    setBannerError(null);
    try {
      // city/email/phone намеренно не уходят в запрос — см. комментарий в
      // `useBranchActions.createBranch` (backend их не знает, поле остаётся
      // в форме как известный, задокументированный пробел).
      await createBranch(
        { name: values.name, code: values.code, address: values.address, timezone: values.timezone },
        values.adminOption === 'existing' && values.adminUserId !== undefined && values.adminUserId.length > 0,
      );
      setDirty(false);
      onClose();
    } catch (error) {
      const handledByField = applyServerValidation<BranchCreateFormValues>(error, ['name', 'code'], helpers.setError, helpers.setFocus);
      if (!handledByField) setBannerError(getGenericErrorMessage(error));
    }
  }

  async function handleEditSubmit(values: BranchEditFormValues): Promise<void> {
    if (editingBranch === undefined) return;
    setBannerError(null);
    try {
      await updateBranch(editingBranch.id, editingBranch.concurrencyToken ?? '', editingBranch.code, {
        name: values.name,
        address: values.address,
        timezone: values.timezone,
      });
      setDirty(false);
      onClose();
    } catch (error) {
      setBannerError(getGenericErrorMessage(error));
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title={state?.mode === 'edit' ? 'Редактировать филиал' : 'Добавить филиал'}
        description={state?.mode === 'edit' ? undefined : 'Создайте новую независимую площадку организации'}
        size="lg"
        preventClose={isSubmitting}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={isSubmitting} onClick={requestClose}>
              Отмена
            </Button>
            <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting}>
              {state?.mode === 'edit' ? 'Сохранить изменения' : 'Создать'}
            </Button>
          </div>
        }
      >
        {state?.mode === 'create' ? (
          <BranchCreateForm formId={FORM_ID} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleCreateSubmit} />
        ) : state?.mode === 'edit' && editingBranch !== undefined ? (
          <BranchEditForm formId={FORM_ID} branch={editingBranch} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleEditSubmit} />
        ) : null}
      </Drawer>

      <UnsavedChangesDialog
        open={unsavedOpen}
        onStay={() => {
          setUnsavedOpen(false);
        }}
        onDiscard={() => {
          setUnsavedOpen(false);
          setDirty(false);
          onClose();
        }}
      />
    </>
  );
}
