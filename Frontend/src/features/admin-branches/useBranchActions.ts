import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  activateBranch as activateBranchApi,
  createBranch as createBranchApi,
  deactivateBranch as deactivateBranchApi,
  updateBranch as updateBranchApi,
} from '../../api/admin/branches';
import { changeUserRole as changeUserRoleApi, deactivateUser as deactivateUserApi } from '../../api/admin/users';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { usersListQueryKey } from '../admin-users/useUsersQuery';
import { useToast } from '../../shared/overlays';
import type { BranchAdminCandidateRef, ChangeBranchAdminInput, PreviewBranchDetails } from './branchPresentation';
import { toBranchDetails } from './useBranchesQuery';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

export interface CreateBranchInput {
  name: string;
  code: string;
  address: string;
  timezone: string;
}

export interface UpdateBranchInput {
  name: string;
  address: string;
  timezone: string;
}

export interface UseBranchActionsResult {
  isSubmitting: boolean;
  createBranch: (input: CreateBranchInput, adminAssignRequested: boolean) => Promise<PreviewBranchDetails>;
  updateBranch: (id: string, concurrencyToken: string, code: string, input: UpdateBranchInput) => Promise<PreviewBranchDetails>;
  activateBranch: (id: string, concurrencyToken: string) => Promise<PreviewBranchDetails>;
  deactivateBranch: (id: string, concurrencyToken: string) => Promise<PreviewBranchDetails>;
  assignAdmin: (branch: PreviewBranchDetails, admin: BranchAdminCandidateRef) => Promise<void>;
  changeAdmin: (branch: PreviewBranchDetails, input: ChangeBranchAdminInput) => Promise<void>;
}

/** Единая точка real-мутаций Branches — POST/PUT + toast, замена `useBranchPreviewActions`. */
export function useBranchActions(): UseBranchActionsResult {
  const { user } = useAuth();
  const organizationId = user?.organization.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-branches', 'list', organizationId] });
  }, [queryClient, organizationId]);

  const invalidateUsers = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: usersListQueryKey(organizationId) });
  }, [queryClient, organizationId]);

  const invalidateAll = useCallback((): void => {
    invalidateList();
    invalidateUsers();
  }, [invalidateList, invalidateUsers]);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true);
    try {
      return await action();
    } catch (error) {
      // `ConfirmDialog`/`BranchFormDrawer` показывают `caught.message` из перехваченной
      // ошибки — здесь всегда пробрасываем человекочитаемый текст, не сырой AxiosError
      // (у него `.message` вида "Request failed with status code 409").
      throw new Error(getGenericErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const createBranch = useCallback(
    async (input: CreateBranchInput, adminAssignRequested: boolean): Promise<PreviewBranchDetails> => {
      // NOTE: backend CreateBranchRequest не знает про city/contactEmail/contactPhone —
      // см. docs/phase-1-owner-organization-admin/Phase_1_Product_Extensions_and_Open_Questions.md
      // §1.1 — поля остаются в форме, но не уходят в запрос (строгая JSON-десериализация
      // backend отклонит неизвестные поля 400-й ошибкой).
      const created = await run(() =>
        createBranchApi({
          name: input.name,
          code: input.code,
          address: input.address.length > 0 ? input.address : null,
          timeZoneId: input.timezone,
        }),
      );
      invalidateList();

      if (adminAssignRequested) {
        // TODO(users-domain): назначение администратора при создании требует
        // POST /users/{id}/change-role — Users-домен вне скоупа этой интеграции
        // (см. §1.2 того же документа). Не подделываем успех: филиал создан
        // по-настоящему, администратор — нет, тост говорит именно это.
        toast.success(`Филиал «${created.name}» создан`);
        toast.info('Назначение администратора при создании пока недоступно — выполните это отдельным действием позже');
      } else {
        toast.success(`Филиал «${created.name}» создан`);
      }

      return toBranchDetails(created);
    },
    [run, invalidateList, toast],
  );

  const updateBranch = useCallback(
    async (id: string, concurrencyToken: string, code: string, input: UpdateBranchInput): Promise<PreviewBranchDetails> => {
      const updated = await run(() =>
        updateBranchApi(id, {
          name: input.name,
          code,
          address: input.address.length > 0 ? input.address : null,
          timeZoneId: input.timezone,
          concurrencyToken,
        }),
      );
      invalidateList();
      toast.success('Данные филиала обновлены');
      return toBranchDetails(updated);
    },
    [run, invalidateList, toast],
  );

  const activateBranch = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewBranchDetails> => {
      const updated = await run(() => activateBranchApi(id, { concurrencyToken }));
      invalidateList();
      toast.success('Филиал активирован');
      return toBranchDetails(updated);
    },
    [run, invalidateList, toast],
  );

  const deactivateBranch = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewBranchDetails> => {
      // confirmActiveUsers сознательно `false`: у DeactivateBranchDialog нет отдельного
      // шага "точно, даже если есть активные пользователи" — если backend ответит 409
      // BRANCH_HAS_ACTIVE_USERS, это просто обычная ошибка через `run()` выше, а не
      // тихо обойдённая проверка.
      const updated = await run(() => deactivateBranchApi(id, { concurrencyToken, confirmActiveUsers: false }));
      invalidateList();
      toast.warning('Филиал деактивирован');
      return toBranchDetails(updated);
    },
    [run, invalidateList, toast],
  );

  const assignAdmin = useCallback(
    async (branch: PreviewBranchDetails, admin: BranchAdminCandidateRef): Promise<void> => {
      await run(() =>
        changeUserRoleApi(admin.id, {
          role: 'Admin',
          adminScope: 'Branch',
          branchId: branch.id,
          categoryId: null,
          reason: `Назначен администратором филиала «${branch.name}»`,
          concurrencyToken: admin.concurrencyToken,
        }),
      );
      invalidateAll();
      toast.success(`${admin.fullName}: назначен администратором филиала`);
    },
    [run, invalidateAll, toast],
  );

  const changeAdmin = useCallback(
    async (branch: PreviewBranchDetails, input: ChangeBranchAdminInput): Promise<void> => {
      await run(async () => {
        await changeUserRoleApi(input.newAdmin.id, {
          role: 'Admin',
          adminScope: 'Branch',
          branchId: branch.id,
          categoryId: null,
          reason: `Назначен администратором филиала «${branch.name}»`,
          concurrencyToken: input.newAdmin.concurrencyToken,
        });
        invalidateAll();
        toast.success(`${input.newAdmin.fullName}: назначен администратором филиала`);

        if (input.previousAdmin === null) return;

        // Судьба предыдущего администратора — отдельная мутация: если новый уже назначен, а этот
        // шаг упадёт, не притворяемся одним общим успехом (тот же приём, что useCategoryActions.changeLead).
        try {
          if (input.previousAdminRoleChoice === 'Deactivate') {
            await deactivateUserApi(input.previousAdmin.id, { concurrencyToken: input.previousAdmin.concurrencyToken });
            toast.success(`${input.previousAdmin.fullName}: доступ деактивирован`);
          } else {
            const role = input.previousAdminRoleChoice;
            await changeUserRoleApi(input.previousAdmin.id, {
              role,
              adminScope: null,
              branchId: branch.id,
              categoryId: input.previousAdminCategoryId,
              reason: `Освобождён от роли администратора филиала «${branch.name}»`,
              concurrencyToken: input.previousAdmin.concurrencyToken,
            });
            toast.success(`${input.previousAdmin.fullName}: переведён в ${role === 'Lead' ? 'руководители направления' : 'менторы'}`);
          }
          invalidateAll();
        } catch (error) {
          toast.error(`Новый администратор назначен, но действие над предыдущим (${input.previousAdmin.fullName}) не выполнено: ${messageOf(error)}`);
        }
      });
    },
    [run, invalidateAll, toast],
  );

  return { isSubmitting, createBranch, updateBranch, activateBranch, deactivateBranch, assignAdmin, changeAdmin };
}
