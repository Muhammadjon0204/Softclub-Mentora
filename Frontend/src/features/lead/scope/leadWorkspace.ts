/**
 * Shared shape definitions for the Lead workspace. The fixture data this file used to hold
 * (`CATEGORY_DIRECTORY`, `MENTOR_DIRECTORY` and the lookup functions built on them — a
 * frontend-owned mirror of the old MSW seed, including fake ids like `usr-1017` and
 * `roster.*@softclub-academy.test` emails) has been deleted: every real Lead page now sources
 * mentors from `GET /users` (`features/lead/scope/useScopedLeadMentors.ts`) and category/branch
 * naming from `AuthUser.category`/`AuthUser.branch` (`features/lead/scope/useLeadScope.ts`), not
 * from a static lookup table. Only the type shapes survive, still reused by the real hooks/pages
 * below as their DTO shape.
 */

export interface CategoryDirectoryEntry {
  id: string;
  name: string;
  branchId: string;
  /** «Сырое» институциональное имя филиала — совпадает с `AuthUser.branch.name`. */
  branchRawName: string;
  /** Городское display-имя (то же соответствие, что и `branchDirectory.ts`). */
  branchDisplayName: string;
  organizationName: string;
  timeZoneId: string;
  isActive: boolean;
}

export type MentorStatus = 'Active' | 'Invited' | 'Locked';

export interface MentorDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  categoryId: string;
  branchId: string;
  status: MentorStatus;
  /** Смещение от `MOCK_NOW` в часах для «последняя активность» — `null`, если ни разу не заходил. */
  lastActiveOffsetHours: number | null;
  createdOffsetDays: number;
}
