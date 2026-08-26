import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  activateCategory as activateCategoryApi,
  createCategory as createCategoryApi,
  deactivateCategory as deactivateCategoryApi,
  updateCategory as updateCategoryApi,
  updateCategorySettings as updateCategorySettingsApi,
} from '../../api/admin/categories';
import { changeUserRole as changeUserRoleApi, deactivateUser as deactivateUserApi } from '../../api/admin/users';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { usersListQueryKey } from '../admin-users/useUsersQuery';
import { useBranchContext } from '../branch-context/useBranchContext';
import { useToast } from '../../shared/overlays';
import { categoriesListQueryKey, resolveLeadInfo, toCategoryDetails } from './useCategoriesQuery';
import type { PreviewCategoryDetails } from './categoryPresentation';

/** Минимум, нужный, чтобы совершить `change-role`/`deactivate` над пользователем — тот же
 * набор, что уже несёт `PreviewUserDetails` (id/concurrencyToken/fullName). */
export interface LeadCandidateRef {
  id: string;
  concurrencyToken: string;
  fullName: string;
}

export interface CreateCategoryInput {
  name: string;
  description: string | null;
  lead: LeadCandidateRef | null;
  /** См. комментарий у `CreateUserInput.branchId` в `useUserActions.ts` — тот же приём: `null` для Branch Admin (заголовок не шлётся), выбор Organization Admin иначе. */
  branchId: string | null;
}

export interface UpdateCategoryInput {
  name: string;
  description: string | null;
  timezone: string;
  defaultDueTimeLocal: string;
  defaultDueDays: number;
  allowLateSubmission: boolean;
}

export type PreviousLeadFate = 'Mentor' | 'Transfer' | 'Deactivate';

export interface ChangeCategoryLeadInput {
  newLead: LeadCandidateRef;
  previousLead: LeadCandidateRef | null;
  previousLeadFate: PreviousLeadFate;
  /** Обязательно при `Transfer` — направление того же Branch. */
  transferTarget?: { id: string; branchId: string; name: string };
}

export interface UseCategoryActionsResult {
  isSubmitting: boolean;
  createCategory: (input: CreateCategoryInput) => Promise<PreviewCategoryDetails>;
  updateCategory: (
    id: string,
    concurrencyToken: string,
    settingsConcurrencyToken: string,
    deadlineReminderHours: number,
    input: UpdateCategoryInput,
  ) => Promise<PreviewCategoryDetails>;
  activateCategory: (id: string, concurrencyToken: string) => Promise<PreviewCategoryDetails>;
  deactivateCategory: (id: string, concurrencyToken: string) => Promise<PreviewCategoryDetails>;
  /** `POST /users/{id}/change-role` — реальный вызов, `reason` генерируется из контекста действия (не переспрашивается у админа — решение уже объяснено выбором «Назначить руководителя»). */
  assignLead: (category: PreviewCategoryDetails, lead: LeadCandidateRef) => Promise<void>;
  /** Оркестрирует до трёх реальных мутаций — см. комментарий внутри. */
  changeLead: (category: PreviewCategoryDetails, input: ChangeCategoryLeadInput) => Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

/**
 * Единая точка real-мутаций Categories — замена `useCategoryPreviewActions`. Кросс-доменная
 * оркестрация (создание категории с руководителем, назначение/смена руководителя) реально
 * дергает `POST /users/{id}/change-role`/`deactivate` — Categories и Users здесь неразделимы,
 * как и на backend («кто руководит направлением» — факт о User, не о Category).
 */
export function useCategoryActions(): UseCategoryActionsResult {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateCategories = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: categoriesListQueryKey(organizationId, branchContext.selectedBranchId) });
  }, [queryClient, organizationId, branchContext.selectedBranchId]);

  const invalidateUsers = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: usersListQueryKey(organizationId) });
  }, [queryClient, organizationId]);

  const invalidateAll = useCallback((): void => {
    invalidateCategories();
    invalidateUsers();
  }, [invalidateCategories, invalidateUsers]);

  /** Один сетевой вызов — переводит ошибку в человекочитаемый текст, isSubmitting не трогает. */
  const call = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      throw new Error(getGenericErrorMessage(error));
    }
  }, []);

  /** Оборачивает целую операцию (может состоять из нескольких `call()`) — isSubmitting держится на всю длительность, без мерцания между шагами. */
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setIsSubmitting(true);
    try {
      return await action();
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const noBranchName = (): string | null => null;

  const createCategory = useCallback(
    async (input: CreateCategoryInput): Promise<PreviewCategoryDetails> => {
      return run(async () => {
        const created = await call(() => createCategoryApi({ name: input.name, description: input.description }, input.branchId ?? undefined));
        invalidateCategories();

        if (input.lead === null) {
          toast.success(`Направление «${created.name}» создано без руководителя`, { title: 'Направление создано' });
          return toCategoryDetails(created, { leadUserId: null, leadName: null, mentorsCount: 0 }, noBranchName);
        }

        // Раздел «Cross-domain orchestration» промпта: категория создана по-настоящему в любом
        // случае — если назначение руководителя ниже упадёт, не откатываем и не прячем частичный
        // результат, а показываем отдельную ошибку.
        try {
          const reason = `Назначен руководителем при создании направления «${created.name}»`;
          await call(() =>
            changeUserRoleApi(input.lead!.id, {
              role: 'Lead',
              adminScope: null,
              branchId: created.branchId,
              categoryId: created.id,
              reason,
              concurrencyToken: input.lead!.concurrencyToken,
            }),
          );
          invalidateUsers();
          toast.success(`Направление «${created.name}» создано, руководитель назначен`, { title: 'Направление создано' });
          return toCategoryDetails(
            created,
            { leadUserId: input.lead.id, leadName: input.lead.fullName, mentorsCount: 0 },
            noBranchName,
          );
        } catch (error) {
          toast.error(`Направление «${created.name}» создано, но назначить руководителя не удалось: ${messageOf(error)}`);
          return toCategoryDetails(created, { leadUserId: null, leadName: null, mentorsCount: 0 }, noBranchName);
        }
      });
    },
    [run, call, invalidateCategories, invalidateUsers, toast],
  );

  const updateCategory = useCallback(
    async (
      id: string,
      concurrencyToken: string,
      settingsConcurrencyToken: string,
      deadlineReminderHours: number,
      input: UpdateCategoryInput,
    ): Promise<PreviewCategoryDetails> => {
      return run(async () => {
        const updated = await call(() => updateCategoryApi(id, { name: input.name, description: input.description, concurrencyToken }));
        invalidateCategories();

        try {
          await call(() =>
            updateCategorySettingsApi(id, {
              timeZoneId: input.timezone,
              defaultAssignmentDueDays: input.defaultDueDays,
              defaultDueTimeLocal: input.defaultDueTimeLocal,
              deadlineReminderHours,
              allowLateSubmission: input.allowLateSubmission,
              concurrencyToken: settingsConcurrencyToken,
            }),
          );
          void queryClient.invalidateQueries({ queryKey: ['admin-categories', 'settings', id] });
          toast.success('Изменения сохранены');
        } catch (error) {
          // Название/описание — отдельный агрегат от настроек (свой concurrencyToken на backend) —
          // их сохранение не откатывается из-за отдельной неудачи настроек.
          toast.error(`Основные данные сохранены, но настройки — нет: ${messageOf(error)}`);
        }

        return toCategoryDetails(updated, resolveLeadInfo(updated.id, []), noBranchName);
      });
    },
    [run, call, invalidateCategories, queryClient, toast],
  );

  const activateCategory = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewCategoryDetails> => {
      return run(async () => {
        const updated = await call(() => activateCategoryApi(id, { concurrencyToken }));
        invalidateCategories();
        toast.success('Направление активировано');
        return toCategoryDetails(updated, resolveLeadInfo(updated.id, []), noBranchName);
      });
    },
    [run, call, invalidateCategories, toast],
  );

  const deactivateCategory = useCallback(
    async (id: string, concurrencyToken: string): Promise<PreviewCategoryDetails> => {
      return run(async () => {
        // confirmActiveUsers сознательно false — у DeactivateCategoryDialog нет отдельного шага
        // подтверждения для 409 CATEGORY_HAS_ACTIVE_USERS (тот же пробел, что и у Branches,
        // см. docs/INTEGRATION_UI_ISSUES.md).
        const updated = await call(() => deactivateCategoryApi(id, { concurrencyToken, confirmActiveUsers: false }));
        invalidateCategories();
        toast.warning('Направление деактивировано');
        return toCategoryDetails(updated, resolveLeadInfo(updated.id, []), noBranchName);
      });
    },
    [run, call, invalidateCategories, toast],
  );

  const assignLead = useCallback(
    async (category: PreviewCategoryDetails, lead: LeadCandidateRef): Promise<void> => {
      await run(async () => {
        const reason = `Назначен руководителем направления «${category.name}»`;
        await call(() =>
          changeUserRoleApi(lead.id, {
            role: 'Lead',
            adminScope: null,
            branchId: category.branchId,
            categoryId: category.id,
            reason,
            concurrencyToken: lead.concurrencyToken,
          }),
        );
        invalidateAll();
        toast.success('Руководитель направления назначен');
      });
    },
    [run, call, invalidateAll, toast],
  );

  const changeLead = useCallback(
    async (category: PreviewCategoryDetails, input: ChangeCategoryLeadInput): Promise<void> => {
      await run(async () => {
        const newLeadReason = `Назначен руководителем направления «${category.name}»`;
        await call(() =>
          changeUserRoleApi(input.newLead.id, {
            role: 'Lead',
            adminScope: null,
            branchId: category.branchId,
            categoryId: category.id,
            reason: newLeadReason,
            concurrencyToken: input.newLead.concurrencyToken,
          }),
        );
        invalidateAll();
        toast.success('Новый руководитель направления назначен');

        if (input.previousLead === null) return;

        // Судьба предыдущего руководителя — отдельная, самостоятельная мутация: если новый
        // руководитель уже назначен, а этот шаг упадёт, не притворяемся одним общим успехом
        // (раздел «Cross-domain orchestration» промпта).
        try {
          if (input.previousLeadFate === 'Deactivate') {
            await call(() => deactivateUserApi(input.previousLead!.id, { concurrencyToken: input.previousLead!.concurrencyToken }));
            toast.success(`${input.previousLead.fullName}: доступ деактивирован`);
          } else if (input.previousLeadFate === 'Mentor') {
            const reason = `Освобождён от роли руководителя направления «${category.name}»`;
            await call(() =>
              changeUserRoleApi(input.previousLead!.id, {
                role: 'Mentor',
                adminScope: null,
                branchId: category.branchId,
                categoryId: category.id,
                reason,
                concurrencyToken: input.previousLead!.concurrencyToken,
              }),
            );
            toast.success(`${input.previousLead.fullName}: переведён в менторы этого направления`);
          } else if (input.previousLeadFate === 'Transfer' && input.transferTarget !== undefined) {
            const target = input.transferTarget;
            const reason = `Переведён в направление «${target.name}» после смены руководителя направления «${category.name}»`;
            await call(() =>
              changeUserRoleApi(input.previousLead!.id, {
                role: 'Mentor',
                adminScope: null,
                branchId: target.branchId,
                categoryId: target.id,
                reason,
                concurrencyToken: input.previousLead!.concurrencyToken,
              }),
            );
            toast.success(`${input.previousLead.fullName}: переведён в направление «${target.name}»`);
          }
          invalidateAll();
        } catch (error) {
          toast.error(`Новый руководитель назначен, но действие над предыдущим руководителем (${input.previousLead.fullName}) не выполнено: ${messageOf(error)}`);
        }
      });
    },
    [run, call, invalidateAll, toast],
  );

  return { isSubmitting, createCategory, updateCategory, activateCategory, deactivateCategory, assignLead, changeLead };
}
