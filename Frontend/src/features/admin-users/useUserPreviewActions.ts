import { useCallback, useState } from 'react';

import { useToast } from '../../shared/overlays';
import { branchDisplayName } from './userPresentation';
import * as store from './userPreviewStore';
import type { PreviewUserDetails } from './userPresentation';

/** Детерминированная задержка mock-мутации (раздел 15 промпта) — без `Math.random`. */
const MOCK_DELAY_MS = 450;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface UseUserPreviewActionsResult {
  isSubmitting: boolean;
  createUser: (input: store.CreateUserInput) => Promise<PreviewUserDetails>;
  updateUser: (id: string, input: store.UpdateUserInput) => Promise<PreviewUserDetails>;
  changeRole: (id: string, input: store.ChangeUserRoleInput) => Promise<PreviewUserDetails>;
  transferUser: (id: string, input: store.TransferUserInput) => Promise<PreviewUserDetails>;
  resendInvitation: (id: string) => Promise<PreviewUserDetails>;
  requestPasswordReset: (id: string) => Promise<PreviewUserDetails>;
  blockUser: (id: string, input: store.BlockUserInput) => Promise<PreviewUserDetails>;
  unblockUser: (id: string) => Promise<PreviewUserDetails>;
  deactivateUser: (id: string) => Promise<PreviewUserDetails>;
}

/**
 * Единая точка mock-мутаций Users для всех overlays этого этапа: задержка +
 * запись в `userPreviewStore` + toast с результатом. Ошибки (например, дубликат
 * email) не глотаются — пробрасываются вызывающей форме для inline-обработки.
 */
export function useUserPreviewActions(): UseUserPreviewActionsResult {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async <T>(action: () => T): Promise<T> => {
    setIsSubmitting(true);
    try {
      await delay(MOCK_DELAY_MS);
      return action();
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const createUser = useCallback(
    async (input: store.CreateUserInput): Promise<PreviewUserDetails> => {
      const created = await run(() => store.createUserPreview(input));
      toast.success(
        input.sendInvitationNow ? `Приглашение отправлено на ${created.email}` : 'Пользователь создан без отправки приглашения',
        { title: 'Пользователь добавлен' },
      );
      return created;
    },
    [run, toast],
  );

  const updateUser = useCallback(
    async (id: string, input: store.UpdateUserInput): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.updateUserPreview(id, input));
      toast.success('Изменения сохранены');
      return updated;
    },
    [run, toast],
  );

  const changeRole = useCallback(
    async (id: string, input: store.ChangeUserRoleInput): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.changeUserRolePreview(id, input));
      toast.success('Роль пользователя изменена');
      return updated;
    },
    [run, toast],
  );

  const transferUser = useCallback(
    async (id: string, input: store.TransferUserInput): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.transferUserPreview(id, input));
      toast.success(`Пользователь переведён в филиал ${branchDisplayName(input.branchName)}`);
      return updated;
    },
    [run, toast],
  );

  const resendInvitation = useCallback(
    async (id: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.resendInvitationPreview(id));
      toast.success('Новое приглашение отправлено');
      return updated;
    },
    [run, toast],
  );

  const requestPasswordReset = useCallback(
    async (id: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.requestPasswordResetPreview(id));
      toast.success('Ссылка сброса пароля отправлена');
      return updated;
    },
    [run, toast],
  );

  const blockUser = useCallback(
    async (id: string, input: store.BlockUserInput): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.blockUserPreview(id, input));
      toast.warning('Пользователь заблокирован');
      return updated;
    },
    [run, toast],
  );

  const unblockUser = useCallback(
    async (id: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.unblockUserPreview(id));
      toast.success('Пользователь разблокирован');
      return updated;
    },
    [run, toast],
  );

  const deactivateUser = useCallback(
    async (id: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => store.deactivateUserPreview(id));
      toast.warning('Пользователь деактивирован');
      return updated;
    },
    [run, toast],
  );

  return {
    isSubmitting,
    createUser,
    updateUser,
    changeRole,
    transferUser,
    resendInvitation,
    requestPasswordReset,
    blockUser,
    unblockUser,
    deactivateUser,
  };
}
