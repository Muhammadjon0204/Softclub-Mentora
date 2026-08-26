import { useEffect, useState } from 'react';

import { getGenericErrorMessage, getProblemCode } from '../../api/problemDetails';
import { useUsersQuery } from '../admin-users/useUsersQuery';
import { Drawer, UnsavedChangesDialog } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { CategoryCreateForm, CategoryEditForm } from './CategoryForm';
import { useCategoriesQuery, useCategorySettingsQuery } from './useCategoriesQuery';
import { useCategoryActions } from './useCategoryActions';
import type { CategoryCreateFormValues, CategoryEditFormValues } from './categoryForm.schema';

export type CategoryFormDrawerState = { mode: 'create' } | { mode: 'edit'; categoryId: string };

const FORM_ID = 'category-form-drawer';

export interface CategoryFormDrawerProps {
  state: CategoryFormDrawerState | null;
  onClose: () => void;
  isOrgAdmin: boolean;
}

/** Один Drawer на create/edit — та же infrastructure, что и `UserFormDrawer`/`BranchFormDrawer`. */
export function CategoryFormDrawer({ state, onClose, isOrgAdmin }: CategoryFormDrawerProps): JSX.Element {
  const { categories } = useCategoriesQuery();
  const { users } = useUsersQuery();
  const { createCategory, updateCategory, isSubmitting } = useCategoryActions();

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
  const settingsQuery = useCategorySettingsQuery(state?.mode === 'edit' ? state.categoryId : null);

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
    const leadUser = values.leadUserId !== undefined && values.leadUserId.length > 0 ? users.find((u) => u.id === values.leadUserId) : undefined;
    try {
      await createCategory({
        name: values.name,
        description: values.description !== undefined && values.description.length > 0 ? values.description : null,
        lead: leadUser !== undefined ? { id: leadUser.id, concurrencyToken: leadUser.concurrencyToken ?? '', fullName: leadUser.fullName } : null,
        branchId: values.branchId,
      });
      setDirty(false);
      onClose();
    } catch (error) {
      // 409 RESOURCE_ALREADY_EXISTS (имя занято в этом филиале) — привязываем к полю.
      if ((getProblemCode(error) as string | null) === 'RESOURCE_ALREADY_EXISTS') {
        helpers.setNameError(getGenericErrorMessage(error));
        return;
      }
      setBannerError(getGenericErrorMessage(error));
    }
  }

  async function handleEditSubmit(values: CategoryEditFormValues): Promise<void> {
    if (editingCategory === undefined || settingsQuery.settings === undefined) return;
    setBannerError(null);
    try {
      await updateCategory(
        editingCategory.id,
        editingCategory.concurrencyToken ?? '',
        settingsQuery.settings.concurrencyToken,
        settingsQuery.settings.deadlineReminderHours,
        {
          name: values.name,
          description: values.description !== undefined && values.description.length > 0 ? values.description : null,
          timezone: values.timezone,
          defaultDueTimeLocal: values.defaultDueTimeLocal,
          defaultDueDays: values.defaultDueDays,
          allowLateSubmission: values.allowLateSubmission,
        },
      );
      setDirty(false);
      onClose();
    } catch (error) {
      setBannerError(getGenericErrorMessage(error));
    }
  }

  const editReady = state?.mode === 'edit' && editingCategory !== undefined && settingsQuery.settings !== undefined;

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
            <Button type="submit" form={FORM_ID} variant="primary" isLoading={isSubmitting} disabled={state?.mode === 'edit' && !editReady}>
              {state?.mode === 'edit' ? 'Сохранить изменения' : 'Создать'}
            </Button>
          </div>
        }
      >
        {state?.mode === 'create' ? (
          <CategoryCreateForm formId={FORM_ID} isOrgAdmin={isOrgAdmin} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleCreateSubmit} />
        ) : state?.mode === 'edit' && editingCategory !== undefined ? (
          settingsQuery.settings !== undefined ? (
            <CategoryEditForm
              formId={FORM_ID}
              category={editingCategory}
              settings={settingsQuery.settings}
              bannerError={bannerError}
              onDirtyChange={setDirty}
              onSubmit={handleEditSubmit}
            />
          ) : (
            <p className="px-1 py-10 text-center text-[13px] text-ink-muted">Загрузка настроек направления…</p>
          )
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
