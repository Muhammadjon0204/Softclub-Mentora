import { useSyncExternalStore } from 'react';

import { PREVIEW_CATEGORIES, type PreviewCategoryColor } from '../../mocks/ui-preview/categories.preview';
import { changeUserRolePreview, deactivateUserPreview, getUserPreview, useUsersPreview } from '../admin-users/userPreviewStore';
import { enrichCategory } from './categoryPresentation';
import type { CategoryActivityEntry, PreviewCategoryDetails } from './categoryPresentation';

/** Тот же паттерн, что `userPreviewStore`/`branchPreviewStore`: immutable-мутации, `useSyncExternalStore`, без localStorage. */
let categories: PreviewCategoryDetails[] = PREVIEW_CATEGORIES.map((category) => enrichCategory(category, []));
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PreviewCategoryDetails[] {
  return categories;
}

export function useCategoriesPreview(): PreviewCategoryDetails[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * `leadUserId` вычисляется по имени Lead при первой загрузке модуля, когда
 * `userPreviewStore` мог быть ещё не готов синхронно — пересчитывает связь
 * при первом рендере, использующем актуальный список пользователей.
 */
export function useCategoriesPreviewResolved(): PreviewCategoryDetails[] {
  const users = useUsersPreview();
  const raw = useCategoriesPreview();
  return raw.map((category) => (category.leadUserId !== null ? category : enrichLeadOnly(category, users)));
}

function enrichLeadOnly(category: PreviewCategoryDetails, users: ReturnType<typeof useUsersPreview>): PreviewCategoryDetails {
  if (category.leadName === null) return category;
  const match = users.find((user) => user.role === 'Lead' && user.fullName === category.leadName && user.branchName === category.branchName);
  if (match === undefined) return category;
  return { ...category, leadUserId: match.id };
}

export function getCategoryPreview(id: string): PreviewCategoryDetails | undefined {
  return categories.find((category) => category.id === id);
}

let nextSeq = categories.length + 1;
function nextCategoryId(): string {
  const id = `cat-new-${nextSeq}`;
  nextSeq += 1;
  return id;
}

const COLOR_CYCLE: PreviewCategoryColor[] = ['indigo', 'blue', 'cyan', 'violet'];

export class CategoryPreviewError extends Error {}

function withActivity(category: PreviewCategoryDetails, entry: Omit<CategoryActivityEntry, 'id'>): PreviewCategoryDetails {
  const stamped: CategoryActivityEntry = { ...entry, id: `${category.id}-ev-${category.activity.length + 1}-${entry.kind}` };
  return { ...category, activity: [stamped, ...category.activity] };
}

function patchCategory(id: string, patcher: (category: PreviewCategoryDetails) => PreviewCategoryDetails): PreviewCategoryDetails {
  const existing = categories.find((category) => category.id === id);
  if (existing === undefined) throw new CategoryPreviewError('Направление не найдено');

  let updated: PreviewCategoryDetails = existing;
  categories = categories.map((category) => {
    if (category.id !== id) return category;
    updated = patcher(category);
    return updated;
  });
  emit();
  return updated;
}

export interface CreateCategoryInput {
  name: string;
  description: string | null;
  branchName: string;
  leadUserId: string | null;
  timezone: string;
  defaultDueTimeLocal: string;
  defaultDueDays: number;
  allowLateSubmission: boolean;
}

/** Уникальность имени в пределах Branch после normalization (CAT-модель, раздел 39.4 ТЗ). */
export function createCategoryPreview(input: CreateCategoryInput): PreviewCategoryDetails {
  const normalizedName = input.name.trim().toLowerCase();
  if (categories.some((category) => category.branchName === input.branchName && category.name.trim().toLowerCase() === normalizedName)) {
    throw new CategoryPreviewError('Направление с таким названием уже существует в этом филиале');
  }

  const id = nextCategoryId();
  const today = 'Сегодня';
  const lead = input.leadUserId !== null ? getUserPreview(input.leadUserId) : undefined;

  const activity: CategoryActivityEntry[] = [
    { id: `${id}-ev-created`, kind: 'created', label: 'Направление создано', actorName: 'Вы', relativeTime: today, absoluteLabel: today },
  ];
  if (lead !== undefined) {
    activity.unshift({ id: `${id}-ev-lead`, kind: 'lead_assigned', label: 'Назначен руководитель направления', detail: lead.fullName, actorName: 'Вы', relativeTime: today, absoluteLabel: today });
  }

  const created: PreviewCategoryDetails = {
    id,
    name: input.name.trim(),
    branchName: input.branchName,
    colorToken: COLOR_CYCLE[categories.length % COLOR_CYCLE.length],
    leadName: lead?.fullName ?? null,
    mentorsCount: 0,
    activeAssignments: 0,
    pendingReview: 0,
    healthPct: 100,
    isActive: true,
    description: input.description,
    leadUserId: input.leadUserId,
    createdLabel: today,
    timezone: input.timezone,
    defaultDueTimeLocal: input.defaultDueTimeLocal,
    defaultDueDays: input.defaultDueDays,
    allowLateSubmission: input.allowLateSubmission,
    completedThisPeriod: 0,
    activity,
  };

  categories = [created, ...categories];
  emit();

  if (lead !== undefined) {
    changeUserRolePreview(lead.id, { role: 'Lead', branchName: input.branchName, categoryName: created.name });
  }

  return created;
}

export interface UpdateCategoryInput {
  name: string;
  description: string | null;
  timezone: string;
  defaultDueTimeLocal: string;
  defaultDueDays: number;
  allowLateSubmission: boolean;
}

export function updateCategoryPreview(id: string, input: UpdateCategoryInput): PreviewCategoryDetails {
  return patchCategory(id, (category) =>
    withActivity(
      { ...category, ...input },
      { kind: 'updated', label: 'Изменены настройки направления', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function assignCategoryLeadPreview(categoryId: string, leadUserId: string): PreviewCategoryDetails {
  const lead = getUserPreview(leadUserId);
  if (lead === undefined) throw new CategoryPreviewError('Пользователь не найден');

  const category = patchCategory(categoryId, (current) =>
    withActivity(
      { ...current, leadUserId, leadName: lead.fullName },
      { kind: 'lead_assigned', label: 'Назначен руководитель направления', detail: lead.fullName, actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );

  changeUserRolePreview(leadUserId, { role: 'Lead', branchName: category.branchName, categoryName: category.name });
  return category;
}

export type PreviousLeadFate = 'Mentor' | 'Transfer' | 'Deactivate';

export interface ChangeCategoryLeadInput {
  newLeadUserId: string;
  previousLeadFate: PreviousLeadFate;
  /** Обязательно при `Transfer` — id направления того же Branch. */
  transferTargetCategoryId?: string;
}

export function changeCategoryLeadPreview(categoryId: string, input: ChangeCategoryLeadInput): PreviewCategoryDetails {
  const current = categories.find((entry) => entry.id === categoryId);
  if (current === undefined) throw new CategoryPreviewError('Направление не найдено');

  const newLead = getUserPreview(input.newLeadUserId);
  if (newLead === undefined) throw new CategoryPreviewError('Пользователь не найден');

  const previousLeadUserId = current.leadUserId;

  const category = patchCategory(categoryId, (existing) =>
    withActivity(
      { ...existing, leadUserId: input.newLeadUserId, leadName: newLead.fullName },
      {
        kind: 'lead_changed',
        label: 'Руководитель направления изменён',
        detail: `${existing.leadName ?? 'Не назначен'} → ${newLead.fullName}`,
        actorName: 'Вы',
        relativeTime: 'Сейчас',
        absoluteLabel: 'Сейчас',
      },
    ),
  );

  changeUserRolePreview(input.newLeadUserId, { role: 'Lead', branchName: category.branchName, categoryName: category.name });

  if (previousLeadUserId !== null) {
    if (input.previousLeadFate === 'Deactivate') {
      deactivateUserPreview(previousLeadUserId);
    } else if (input.previousLeadFate === 'Mentor') {
      changeUserRolePreview(previousLeadUserId, { role: 'Mentor', branchName: category.branchName, categoryName: category.name });
    } else if (input.previousLeadFate === 'Transfer' && input.transferTargetCategoryId !== undefined) {
      const targetCategory = categories.find((entry) => entry.id === input.transferTargetCategoryId);
      if (targetCategory !== undefined) {
        changeUserRolePreview(previousLeadUserId, { role: 'Mentor', branchName: targetCategory.branchName, categoryName: targetCategory.name });
      }
    }
  }

  return category;
}

export function activateCategoryPreview(id: string): PreviewCategoryDetails {
  return patchCategory(id, (category) =>
    withActivity({ ...category, isActive: true }, { kind: 'activated', label: 'Направление активировано', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' }),
  );
}

export function deactivateCategoryPreview(id: string): PreviewCategoryDetails {
  return patchCategory(id, (category) =>
    withActivity({ ...category, isActive: false }, { kind: 'deactivated', label: 'Направление деактивировано', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' }),
  );
}
