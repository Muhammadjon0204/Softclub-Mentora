import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  activateBranch as activateBranchApi,
  createBranch as createBranchApi,
  deactivateBranch as deactivateBranchApi,
  updateBranch as updateBranchApi,
} from '../../api/admin/branches';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../shared/overlays';
import type { PreviewBranchDetails } from './branchPresentation';
import { toBranchDetails } from './useBranchesQuery';

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
  /** TODO(users-domain): требует `POST /users/{id}/change-role` — вне скоупа этой интеграции. */
  assignAdmin: (branchId: string) => Promise<void>;
  /** TODO(users-domain): требует `POST /users/{id}/change-role` — вне скоупа этой интеграции. */
  changeAdmin: (branchId: string) => Promise<void>;
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

  const assignAdmin = useCallback(async (): Promise<void> => {
    // TODO(users-domain): POST /users/{id}/change-role — вне скоупа этой интеграции.
    toast.info('Назначение администратора филиала пока недоступно — Users-домен ещё не подключён к реальному API');
  }, [toast]);

  const changeAdmin = useCallback(async (): Promise<void> => {
    // TODO(users-domain): POST /users/{id}/change-role — вне скоупа этой интеграции.
    toast.info('Смена администратора филиала пока недоступна — Users-домен ещё не подключён к реальному API');
  }, [toast]);

  return { isSubmitting, createBranch, updateBranch, activateBranch, deactivateBranch, assignAdmin, changeAdmin };
}
