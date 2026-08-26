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
  /**
   * Скрытое поле для реальных mutate-вызовов (PUT/activate/deactivate/make-head-office) —
   * нигде не отображается. `undefined` у филиалов, полученных как `BranchSummaryDto`
   * (Lead/Mentor/Branch Admin про свой филиал — там мутаций и так нет, кнопки скрыты
   * для не-Organization-Admin в `BranchActionMenu`).
   */
  concurrencyToken?: string;
}

export type PreviousAdminRoleChoice = 'Lead' | 'Mentor' | 'Deactivate';

export interface ChangeBranchAdminInput {
  newAdminUserId: string;
  previousAdminRoleChoice: PreviousAdminRoleChoice;
  previousAdminCategoryName: string | null;
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
