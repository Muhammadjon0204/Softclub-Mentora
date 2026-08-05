import { useSyncExternalStore } from 'react';

import { changeUserRolePreview, deactivateUserPreview, getUserPreview } from '../admin-users/userPreviewStore';
import { PREVIEW_BRANCHES, type PreviewBranch } from '../../mocks/ui-preview/branches.preview';
import { registerBranchDirectoryEntry } from '../admin-preview/branchDirectory';
import { enrichBranch } from './branchPresentation';
import type { BranchActivityEntry, PreviewBranchDetails } from './branchPresentation';

/**
 * Module-level preview store для Branches — тот же паттерн, что и `userPreviewStore`
 * (raздел 38 промпта): immutable-мутации, `useSyncExternalStore`, без localStorage.
 * Назначение/смена администратора вызывают мутации `userPreviewStore` напрямую —
 * единственное место, где роль/филиал пользователя меняются как побочный эффект
 * действия над филиалом.
 */
let branches: PreviewBranchDetails[] = PREVIEW_BRANCHES.map(enrichBranch);
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

function getSnapshot(): PreviewBranchDetails[] {
  return branches;
}

export function useBranchesPreview(): PreviewBranchDetails[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getBranchPreview(id: string): PreviewBranchDetails | undefined {
  return branches.find((branch) => branch.id === id);
}

let nextSeq = branches.length + 1;
function nextBranchId(): string {
  const id = `branch-new-${nextSeq}`;
  nextSeq += 1;
  return id;
}

export class BranchPreviewError extends Error {}

function withActivity(branch: PreviewBranchDetails, entry: Omit<BranchActivityEntry, 'id'>): PreviewBranchDetails {
  const stamped: BranchActivityEntry = { ...entry, id: `${branch.id}-ev-${branch.activity.length + 1}-${entry.kind}` };
  return { ...branch, activity: [stamped, ...branch.activity] };
}

function patchBranch(id: string, patcher: (branch: PreviewBranchDetails) => PreviewBranchDetails): PreviewBranchDetails {
  const existing = branches.find((branch) => branch.id === id);
  if (existing === undefined) throw new BranchPreviewError('Филиал не найден');

  let updated: PreviewBranchDetails = existing;
  branches = branches.map((branch) => {
    if (branch.id !== id) return branch;
    updated = patcher(branch);
    return updated;
  });
  emit();
  return updated;
}

export interface CreateBranchInput {
  name: string;
  code: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  timezone: string;
  adminUserId: string | null;
}

export function createBranchPreview(input: CreateBranchInput): PreviewBranchDetails {
  const normalizedName = input.name.trim().toLowerCase();
  const normalizedCode = input.code.trim().toUpperCase();

  if (branches.some((branch) => branch.name.trim().toLowerCase() === normalizedName)) {
    throw new BranchPreviewError('Филиал с таким названием уже существует');
  }
  if (branches.some((branch) => branch.code.toUpperCase() === normalizedCode)) {
    throw new BranchPreviewError('Код филиала уже используется');
  }

  const id = nextBranchId();
  const today = 'Сегодня';
  const admin = input.adminUserId !== null ? getUserPreview(input.adminUserId) : undefined;
  const trimmedName = input.name.trim();

  const base: PreviewBranch = {
    id,
    name: trimmedName,
    code: normalizedCode,
    address: input.address.trim(),
    isHeadOffice: false,
    adminName: admin?.fullName ?? null,
    categoriesCount: 0,
    mentorsCount: 0,
    activeAssignments: 0,
    isActive: true,
    healthPct: 100,
  };

  const activity: BranchActivityEntry[] = [
    { id: `${id}-ev-created`, kind: 'created', label: 'Филиал создан', actorName: 'Вы', relativeTime: today, absoluteLabel: today },
  ];
  if (admin !== undefined) {
    activity.unshift({
      id: `${id}-ev-admin`,
      kind: 'admin_assigned',
      label: 'Назначен администратор',
      detail: admin.fullName,
      actorName: 'Вы',
      relativeTime: today,
      absoluteLabel: today,
    });
  }

  const created: PreviewBranchDetails = {
    ...base,
    city: input.city.trim(),
    timezone: input.timezone,
    email: input.email.trim().length > 0 ? input.email.trim() : null,
    phone: input.phone.trim().length > 0 ? input.phone.trim() : null,
    createdLabel: today,
    adminUserId: input.adminUserId,
    activity,
  };

  branches = [created, ...branches];
  registerBranchDirectoryEntry({ id, rawName: trimmedName, displayName: trimmedName });
  emit();

  if (admin !== undefined) {
    changeUserRolePreview(admin.id, { role: 'BranchAdmin', branchName: trimmedName, categoryName: null });
  }

  return created;
}

export interface UpdateBranchInput {
  name: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  timezone: string;
}

export function updateBranchPreview(id: string, input: UpdateBranchInput): PreviewBranchDetails {
  return patchBranch(id, (branch) =>
    withActivity(
      {
        ...branch,
        name: input.name.trim(),
        city: input.city.trim(),
        address: input.address.trim(),
        email: input.email.trim().length > 0 ? input.email.trim() : null,
        phone: input.phone.trim().length > 0 ? input.phone.trim() : null,
        timezone: input.timezone,
      },
      { kind: 'updated', label: 'Изменены данные филиала', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function assignBranchAdminPreview(branchId: string, adminUserId: string): PreviewBranchDetails {
  const admin = getUserPreview(adminUserId);
  if (admin === undefined) throw new BranchPreviewError('Пользователь не найден');

  const branch = patchBranch(branchId, (current) =>
    withActivity(
      { ...current, adminUserId, adminName: admin.fullName },
      { kind: 'admin_assigned', label: 'Назначен администратор', detail: admin.fullName, actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );

  changeUserRolePreview(adminUserId, { role: 'BranchAdmin', branchName: branch.name, categoryName: null });
  return branch;
}

export type PreviousAdminRoleChoice = 'Lead' | 'Mentor' | 'Deactivate';

export interface ChangeBranchAdminInput {
  newAdminUserId: string;
  previousAdminRoleChoice: PreviousAdminRoleChoice;
  previousAdminCategoryName: string | null;
}

export function changeBranchAdminPreview(branchId: string, input: ChangeBranchAdminInput): PreviewBranchDetails {
  const current = branches.find((entry) => entry.id === branchId);
  if (current === undefined) throw new BranchPreviewError('Филиал не найден');

  const newAdmin = getUserPreview(input.newAdminUserId);
  if (newAdmin === undefined) throw new BranchPreviewError('Пользователь не найден');

  const previousAdminUserId = current.adminUserId;

  const branch = patchBranch(branchId, (existing) =>
    withActivity(
      { ...existing, adminUserId: input.newAdminUserId, adminName: newAdmin.fullName },
      {
        kind: 'admin_changed',
        label: 'Администратор филиала изменён',
        detail: `${existing.adminName ?? 'Не назначен'} → ${newAdmin.fullName}`,
        actorName: 'Вы',
        relativeTime: 'Сейчас',
        absoluteLabel: 'Сейчас',
      },
    ),
  );

  changeUserRolePreview(input.newAdminUserId, { role: 'BranchAdmin', branchName: branch.name, categoryName: null });

  if (previousAdminUserId !== null) {
    if (input.previousAdminRoleChoice === 'Deactivate') {
      deactivateUserPreview(previousAdminUserId);
    } else {
      changeUserRolePreview(previousAdminUserId, {
        role: input.previousAdminRoleChoice,
        branchName: branch.name,
        categoryName: input.previousAdminCategoryName,
      });
    }
  }

  return branch;
}

export function activateBranchPreview(id: string): PreviewBranchDetails {
  return patchBranch(id, (branch) =>
    withActivity(
      { ...branch, isActive: true },
      { kind: 'activated', label: 'Филиал активирован', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}

export function deactivateBranchPreview(id: string): PreviewBranchDetails {
  return patchBranch(id, (branch) =>
    withActivity(
      { ...branch, isActive: false },
      { kind: 'deactivated', label: 'Филиал деактивирован', actorName: 'Вы', relativeTime: 'Сейчас', absoluteLabel: 'Сейчас' },
    ),
  );
}
