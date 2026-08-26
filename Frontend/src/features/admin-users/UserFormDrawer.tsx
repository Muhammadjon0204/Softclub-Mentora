import { useEffect, useState } from 'react';

import { getGenericErrorMessage, getProblemCode } from '../../api/problemDetails';
import { Drawer, UnsavedChangesDialog } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { UserCreateForm, UserEditForm } from './UserForm';
import { useUserActions } from './useUserActions';
import { useUsersQuery } from './useUsersQuery';
import type { UserCreateFormValues, UserEditFormValues } from './userForm.schema';

export type UserFormDrawerState = { mode: 'create' } | { mode: 'edit'; userId: string };

const FORM_ID = 'user-form-drawer';

export interface UserFormDrawerProps {
  state: UserFormDrawerState | null;
  onClose: () => void;
  isOrgAdmin: boolean;
}

/**
 * Один Drawer на create/edit (раздел 16 промпта): `mode` переключает форму,
 * но infrastructure (dirty-tracking, UnsavedChangesDialog, submitting lock)
 * общая.
 */
export function UserFormDrawer({ state, onClose, isOrgAdmin }: UserFormDrawerProps): JSX.Element {
  const { users } = useUsersQuery();
  const { createUser, updateUser, isSubmitting } = useUserActions();

  const [dirty, setDirty] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);

  useEffect(() => {
    setDirty(false);
    setBannerError(null);
    setUnsavedOpen(false);
  }, [state]);

  const open = state !== null;
  const editingUser = state?.mode === 'edit' ? users.find((user) => user.id === state.userId) : undefined;

  function requestClose(): void {
    if (isSubmitting) return;
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    onClose();
  }

  async function handleCreateSubmit(values: UserCreateFormValues, helpers: { setEmailError: (message: string) => void }): Promise<void> {
    setBannerError(null);
    try {
      await createUser({
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        branchId: values.branchId,
        categoryId: values.categoryId !== undefined && values.categoryId.length > 0 ? values.categoryId : null,
        notificationLanguage: values.notificationLanguage,
        sendInvitationNow: values.sendInvitationNow,
      });
      setDirty(false);
      onClose();
    } catch (error) {
      // 409 RESOURCE_ALREADY_EXISTS (email занят) — привязываем к полю, как раньше делал preview store.
      // Код не входит в `AuthErrorCode` (см. комментарий у `getGenericErrorMessage` в problemDetails.ts) — сравниваем как строку.
      if ((getProblemCode(error) as string | null) === 'RESOURCE_ALREADY_EXISTS') {
        helpers.setEmailError(getGenericErrorMessage(error));
        return;
      }
      setBannerError(getGenericErrorMessage(error));
    }
  }

  async function handleEditSubmit(values: UserEditFormValues): Promise<void> {
    if (editingUser === undefined) return;
    setBannerError(null);
    try {
      await updateUser(editingUser.id, editingUser.concurrencyToken ?? '', values);
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
        title={state?.mode === 'edit' ? 'Редактировать пользователя' : 'Добавить пользователя'}
        description={state?.mode === 'edit' ? undefined : 'Пользователь получит приглашение для установки пароля'}
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
          <UserCreateForm formId={FORM_ID} isOrgAdmin={isOrgAdmin} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleCreateSubmit} />
        ) : state?.mode === 'edit' && editingUser !== undefined ? (
          <UserEditForm formId={FORM_ID} user={editingUser} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleEditSubmit} />
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
