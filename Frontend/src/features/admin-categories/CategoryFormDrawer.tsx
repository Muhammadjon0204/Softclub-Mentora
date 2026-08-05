import { useEffect, useState } from 'react';

import { Drawer, UnsavedChangesDialog } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { CategoryCreateForm, CategoryEditForm } from './CategoryForm';
import { CategoryPreviewError, useCategoriesPreviewResolved } from './categoryPreviewStore';
import { useCategoryPreviewActions } from './useCategoryPreviewActions';
import type { CategoryCreateFormValues, CategoryEditFormValues } from './categoryForm.schema';

export type CategoryFormDrawerState = { mode: 'create' } | { mode: 'edit'; categoryId: string };

const FORM_ID = 'category-form-drawer';

export interface CategoryFormDrawerProps {
  state: CategoryFormDrawerState | null;
  onClose: () => void;
  isOrgAdmin: boolean;
  currentBranchRawName: string | null;
}

/** Один Drawer на create/edit — та же infrastructure, что и `UserFormDrawer`/`BranchFormDrawer`. */
export function CategoryFormDrawer({ state, onClose, isOrgAdmin, currentBranchRawName }: CategoryFormDrawerProps): JSX.Element {
  const categories = useCategoriesPreviewResolved();
  const { createCategory, updateCategory, isSubmitting } = useCategoryPreviewActions();

  const [dirty, setDirty] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  useEffect(() => {
    setDirty(false);
    setBannerError(null);
    setUnsavedOpen(false);
  }, [state]);

  const open = state !== null;
  const editingCategory = state?.mode === 'edit' ? categories.find((category) => category.id === state.categoryId) : undefined;

  function requestClose(): void {
    if (isSubmitting) return;
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    onClose();
  }

  async function handleCreateSubmit(values: CategoryCreateFormValues, helpers: { setNameError: (message: string) => void }): Promise<void> {
    setBannerError(null);
    try {
      await createCategory({
        name: values.name,
        description: values.description !== undefined && values.description.length > 0 ? values.description : null,
        branchName: values.branchName,
        leadUserId: values.leadUserId !== undefined && values.leadUserId.length > 0 ? values.leadUserId : null,
        timezone: values.timezone,
        defaultDueTimeLocal: values.defaultDueTimeLocal,
        defaultDueDays: values.defaultDueDays,
        allowLateSubmission: values.allowLateSubmission,
      });
      setDirty(false);
      onClose();
    } catch (error) {
      if (error instanceof CategoryPreviewError) {
        helpers.setNameError(error.message);
        return;
      }
      setBannerError('Не удалось создать направление. Попробуйте ещё раз.');
    }
  }

  async function handleEditSubmit(values: CategoryEditFormValues): Promise<void> {
    if (editingCategory === undefined) return;
    setBannerError(null);
    try {
      await updateCategory(editingCategory.id, {
        name: values.name,
        description: values.description !== undefined && values.description.length > 0 ? values.description : null,
        timezone: values.timezone,
        defaultDueTimeLocal: values.defaultDueTimeLocal,
        defaultDueDays: values.defaultDueDays,
        allowLateSubmission: values.allowLateSubmission,
      });
      setDirty(false);
      onClose();
    } catch {
      setBannerError('Не удалось сохранить изменения. Попробуйте ещё раз.');
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title={state?.mode === 'edit' ? 'Редактировать направление' : 'Создать направление'}
        description={state?.mode === 'edit' ? undefined : 'Добавьте направление внутри выбранного филиала'}
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
          <CategoryCreateForm
            formId={FORM_ID}
            isOrgAdmin={isOrgAdmin}
            currentBranchRawName={currentBranchRawName}
            bannerError={bannerError}
            onDirtyChange={setDirty}
            onSubmit={handleCreateSubmit}
          />
        ) : state?.mode === 'edit' && editingCategory !== undefined ? (
          <CategoryEditForm formId={FORM_ID} category={editingCategory} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleEditSubmit} />
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
