import type { PreviewBranch } from '../../mocks/ui-preview/branches.preview';
import { branchIdFromRawName, branchRawNameFromId } from '../admin-preview/branchDirectory';

export { branchDisplayName, branchIdFromRawName, branchRawNameFromId, BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Dushanbe', label: 'Asia/Dushanbe (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+6)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
] as const;
export const DEFAULT_TIMEZONE = 'Asia/Dushanbe';

export type BranchActivityKind = 'created' | 'updated' | 'admin_assigned' | 'admin_changed' | 'activated' | 'deactivated';

export interface BranchActivityEntry {
  id: string;
  kind: BranchActivityKind;
  label: string;
  detail?: string;
  actorName: string;
  relativeTime: string;
  absoluteLabel: string;
}

export interface PreviewBranchDetails extends PreviewBranch {
  city: string;
  timezone: string;
  email: string | null;
  phone: string | null;
  createdLabel: string;
  adminUserId: string | null;
  activity: BranchActivityEntry[];
}

const SEED_EMAIL: Record<string, string | null> = {
  'branch-hq': 'dushanbe@softclub-academy.test',
  'branch-khu': 'khujand@softclub-academy.test',
  'branch-bok': null,
};

const SEED_PHONE: Record<string, string | null> = {
  'branch-hq': '+992 37 221-00-11',
  'branch-khu': '+992 34 222-00-22',
  'branch-bok': null,
};

const SEED_ADMIN_USER_ID: Record<string, string | null> = {
  'branch-hq': 'usr-01',
  'branch-khu': 'usr-02',
  'branch-bok': null,
};

const SEED_CREATED_LABEL: Record<string, string> = {
  'branch-hq': '02.02.2023',
  'branch-khu': '14.03.2023',
  'branch-bok': '21.06.2023',
};

function buildInitialActivity(branch: PreviewBranch): BranchActivityEntry[] {
  const createdLabel = SEED_CREATED_LABEL[branch.id] ?? branch.id;
  const entries: BranchActivityEntry[] = [
    { id: `${branch.id}-ev-created`, kind: 'created', label: 'Филиал создан', actorName: 'Администратор организации', relativeTime: createdLabel, absoluteLabel: createdLabel },
  ];
  if (branch.adminName !== null) {
    entries.push({
      id: `${branch.id}-ev-admin`,
      kind: 'admin_assigned',
      label: 'Назначен администратор',
      detail: branch.adminName,
      actorName: 'Администратор организации',
      relativeTime: createdLabel,
      absoluteLabel: createdLabel,
    });
  }
  return entries.reverse();
}

/** Достраивает preview-филиал контактами/таймзоной/активностью, не трогая `branches.preview.ts`. */
export function enrichBranch(branch: PreviewBranch): PreviewBranchDetails {
  return {
    ...branch,
    city: branch.name,
    timezone: DEFAULT_TIMEZONE,
    email: SEED_EMAIL[branch.id] ?? null,
    phone: SEED_PHONE[branch.id] ?? null,
    createdLabel: SEED_CREATED_LABEL[branch.id] ?? '—',
    adminUserId: SEED_ADMIN_USER_ID[branch.id] ?? null,
    activity: buildInitialActivity(branch),
  };
}

export function emptyOrValue(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim().length === 0 ? 'Не назначено' : value;
}

/** Раскрывает `branchIdFromRawName`/`branchRawNameFromId` для случаев, когда справочник ещё не проверен. */
export function requireBranchRawName(branchId: string): string {
  return branchRawNameFromId(branchId) ?? branchId;
}

export function requireBranchId(rawName: string): string {
  return branchIdFromRawName(rawName) ?? rawName;
}
