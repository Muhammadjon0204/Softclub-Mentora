import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  activateUser as activateUserApi,
  changeUserBranch as changeUserBranchApi,
  changeUserRole as changeUserRoleApi,
  createUser as createUserApi,
  deactivateUser as deactivateUserApi,
  patchUser as patchUserApi,
  resendInvitation as resendInvitationApi,
} from '../../api/admin/users';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../shared/overlays';
import type { PreviewUserRole } from '../../mocks/ui-preview/users.preview';
import type { NotificationLanguage, PreviewUserDetails } from './userPresentation';
import { fromAssignableRole, toUserDetails, usersListQueryKey } from './useUsersQuery';
import type { BranchNameLookup } from './useUsersQuery';

export interface CreateUserInput {
  fullName: string;
  email: string;
  role: Exclude<PreviewUserRole, 'OrgAdmin'>;
  categoryId: string | null;
  /**
   * `CreateUserRequest` не несёт `branchId` — сервер решает по `X-MTF-Branch-Id`/claims. Для
   * Organization Admin это выбор в форме (передаётся как явный override заголовка, см.
   * `api/admin/users.ts#createUser`); для Branch Admin — `null`, заголовок вообще не шлётся
   * (иначе 403 `SCOPE_OVERRIDE_FORBIDDEN` — заголовок разрешён только Organization Admin).
   */
  branchId: string | null;
  /** Не уходит в запрос — форма его хранит для UI, backend не знает такого поля (docs §3.5). */
  notificationLanguage: NotificationLanguage;
  /**
   * `POST /users` у backend отправляет приглашение ВСЕГДА (`UserService.CreateAsync` вызывает
   * `IssueInvitationAsync` безусловно) — отдельного флага «создать без приглашения» в контракте
   * нет. Поле сохранено в форме (чекбокс), но не уходит в запрос — см. новую запись в
   * `docs/INTEGRATION_UI_ISSUES.md` про несоответствие ожиданий UI и реального поведения.
   */
  sendInvitationNow: boolean;
}

export interface UpdateUserInput {
  fullName: string;
  notificationLanguage: NotificationLanguage;
}

export interface ChangeUserRoleInput {
  role: Exclude<PreviewUserRole, 'OrgAdmin'>;
  /** `null` — не передавать (подразумевает текущий филиал пользователя); задаёт только Organization Admin. */
  branchId: string | null;
  categoryId: string | null;
  reason: string;
}

export interface TransferUserInput {
  newBranchId: string;
  newCategoryId: string | null;
  reason: string;
}

export interface UseUserActionsResult {
  isSubmitting: boolean;
  createUser: (input: CreateUserInput) => Promise<PreviewUserDetails>;
  updateUser: (id: string, concurrencyToken: string, input: UpdateUserInput) => Promise<PreviewUserDetails>;
  activateUser: (id: string, concurrencyToken: string) => Promise<PreviewUserDetails>;
  deactivateUser: (id: string, concurrencyToken: string) => Promise<PreviewUserDetails>;
  changeRole: (id: string, concurrencyToken: string, input: ChangeUserRoleInput) => Promise<PreviewUserDetails>;
  transferUser: (id: string, concurrencyToken: string, input: TransferUserInput) => Promise<PreviewUserDetails>;
  resendInvitation: (id: string) => Promise<void>;
  /** TODO(docs §3.4): admin-инициированный сброс пароля уже активного пользователя — Product Decision Required, `resend-invitation` для этого случая семантически неверен. */
  requestPasswordReset: (id: string) => Promise<void>;
  /** TODO(docs §3.3): Block/Unblock — Product Decision Required, backend не хранит состояние «заблокирован администратором». */
  blockUser: (id: string) => Promise<void>;
  /** TODO(docs §3.3), см. `blockUser`. */
  unblockUser: (id: string) => Promise<void>;
}

/** Единая точка real-мутаций Users — POST/PATCH + toast, замена `useUserPreviewActions`. */
export function useUserActions(): UseUserActionsResult {
  const { user } = useAuth();
  const organizationId = user?.organization.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: usersListQueryKey(organizationId) });
  }, [queryClient, organizationId]);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true);
    try {
      return await action();
    } catch (error) {
      throw new Error(getGenericErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Имя филиала для отображения сразу после мутации не нужно резолвить точно — списки
  // инвалидируются и настоящее имя подтянется из свежего useUsersQuery(); здесь достаточно
  // best-effort (branch/category из ответа DTO, если есть) без похода за branch-context.
  const noBranchNameLookup: BranchNameLookup = () => null;

  const createUser = useCallback(
    async (input: CreateUserInput): Promise<PreviewUserDetails> => {
      const { role, adminScope } = fromAssignableRole(input.role);
      const created = await run(() =>
        createUserApi(
          {
            fullName: input.fullName,
            email: input.email,
            role,
            adminScope,
            categoryId: input.categoryId,
          },
          input.branchId ?? undefined,
        ),
      );
      invalidateList();
      // Backend отправляет приглашение всегда, независимо от `sendInvitationNow` — тост отражает
      // реальное поведение, а не выбор в форме (см. комментарий в CreateUserInput).
      toast.success(`Приглашение отправлено на ${created.email}`, { title: 'Пользователь добавлен' });
      return toUserDetails(created, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const updateUser = useCallback(
    async (id: string, concurrencyToken: string, input: UpdateUserInput): Promise<PreviewUserDetails> => {
      const updated = await run(() => patchUserApi(id, { fullName: input.fullName, concurrencyToken }));
      invalidateList();
      toast.success('Изменения сохранены');
      return toUserDetails(updated, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const activateUser = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => activateUserApi(id, { concurrencyToken }));
      invalidateList();
      toast.success('Пользователь активирован');
      return toUserDetails(updated, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const deactivateUser = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewUserDetails> => {
      const updated = await run(() => deactivateUserApi(id, { concurrencyToken }));
      invalidateList();
      toast.warning('Пользователь деактивирован');
      return toUserDetails(updated, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const changeRole = useCallback(
    async (id: string, concurrencyToken: string, input: ChangeUserRoleInput): Promise<PreviewUserDetails> => {
      const { role, adminScope } = fromAssignableRole(input.role);
      const updated = await run(() =>
        changeUserRoleApi(id, {
          role,
          adminScope,
          branchId: input.branchId,
          categoryId: input.categoryId,
          reason: input.reason,
          concurrencyToken,
        }),
      );
      invalidateList();
      toast.success('Роль пользователя изменена');
      return toUserDetails(updated, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const transferUser = useCallback(
    async (id: string, concurrencyToken: string, input: TransferUserInput): Promise<PreviewUserDetails> => {
      const updated = await run(() =>
        changeUserBranchApi(id, {
          newBranchId: input.newBranchId,
          newCategoryId: input.newCategoryId,
          reason: input.reason,
          concurrencyToken,
        }),
      );
      invalidateList();
      toast.success('Пользователь переведён в другой филиал');
      return toUserDetails(updated, noBranchNameLookup, new Map());
    },
    [run, invalidateList, toast],
  );

  const resendInvitation = useCallback(
    async (id: string): Promise<void> => {
      await run(() => resendInvitationApi(id));
      void queryClient.invalidateQueries({ queryKey: ['user-invitation-notification', id] });
      toast.success('Новое приглашение отправлено');
    },
    [run, toast, queryClient],
  );

  const requestPasswordReset = useCallback(async (): Promise<void> => {
    // TODO(docs §3.4): нет backend-эндпоинта для сброса пароля уже активного пользователя —
    // `resend-invitation` предназначен только для тех, кто ещё не установил пароль (иначе было бы
    // семантически неверным использованием, см. предупреждение в самом документе).
    toast.info('Отправка ссылки сброса пароля для активного пользователя пока недоступна — решение продукта не принято (см. документацию)');
  }, [toast]);

  const blockUser = useCallback(async (): Promise<void> => {
    // TODO(docs §3.3): у backend нет отдельного состояния «заблокирован администратором» —
    // не подменяем его Deactivate, пока Product не решит, отличается ли Block по смыслу.
    toast.info('Блокировка пользователя пока недоступна — решение продукта не принято (см. документацию)');
  }, [toast]);

  const unblockUser = useCallback(async (): Promise<void> => {
    // TODO(docs §3.3), см. blockUser.
    toast.info('Разблокировка пользователя пока недоступна — решение продукта не принято (см. документацию)');
  }, [toast]);

  return {
    isSubmitting,
    createUser,
    updateUser,
    activateUser,
    deactivateUser,
    changeRole,
    transferUser,
    resendInvitation,
    requestPasswordReset,
    blockUser,
    unblockUser,
  };
}
