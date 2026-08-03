import { db } from '../db';
import { allAssignments, type MockAssignment, type AssignmentStatus } from './assignments';
import { BRANCHES, CATEGORIES, categoriesOfBranch, findBranch, findCategory } from './organization';
import { DAY_MS, MOCK_NOW } from './reference';

export interface ScopeFilter {
  /** `null` — режим «Все филиалы» (только Organization Admin, только чтение). */
  branchId: string | null;
  categoryId?: string;
}

const NON_WORKING_STATUSES = new Set<AssignmentStatus>(['Draft', 'Suggested', 'Cancelled']);
const PENDING_REVIEW_STATUSES = new Set<AssignmentStatus>(['Submitted', 'InReview']);
const ACTIVE_STATUSES = new Set<AssignmentStatus>([
  'Assigned',
  'Submitted',
  'InReview',
  'NeedsRework',
  'Overdue',
]);

export function filterAssignments(scope: ScopeFilter): MockAssignment[] {
  return allAssignments().filter((assignment) => {
    if (scope.branchId !== null && assignment.branchId !== scope.branchId) return false;
    if (scope.categoryId !== undefined && assignment.categoryId !== scope.categoryId) return false;
    return true;
  });
}

export interface DashboardKpis {
  totalUsers: number;
  activeMentors: number;
  activeAssignments: number;
  pendingReview: number;
  totalUsersDeltaPct: number;
  activeMentorsDeltaPct: number;
  activeAssignmentsDeltaPct: number;
  pendingReviewDeltaPct: number;
}

function usersInScope(scope: ScopeFilter): typeof db.users {
  return db.users.filter((user) => {
    if (scope.branchId !== null && user.branchId !== scope.branchId) return false;
    if (scope.categoryId !== undefined && user.categoryId !== scope.categoryId) return false;
    return true;
  });
}

export function computeDashboardKpis(scope: ScopeFilter): DashboardKpis {
  const users = usersInScope(scope);
  const assignments = filterAssignments(scope);
  const activeMentors = users.filter((user) => user.role === 'Mentor' && user.isActive).length;
  const activeAssignments = assignments.filter((a) => ACTIVE_STATUSES.has(a.status)).length;
  const pendingReview = assignments.filter((a) => PENDING_REVIEW_STATUSES.has(a.status)).length;

  return {
    totalUsers: users.length,
    activeMentors,
    activeAssignments,
    pendingReview,
    // Детерминированные, но правдоподобные «изменения за период» — не случайные.
    totalUsersDeltaPct: 12.5,
    activeMentorsDeltaPct: 8.1,
    activeAssignmentsDeltaPct: 15.3,
    pendingReviewDeltaPct: -4.7,
  };
}

export interface ActivityPoint {
  dateLabel: string;
  submitted: number;
  approved: number;
  overdue: number;
}

const RU_DATE_FMT = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

export function computeActivitySeries(scope: ScopeFilter, days = 7): ActivityPoint[] {
  const assignments = filterAssignments(scope);
  const points: ActivityPoint[] = [];

  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex -= 1) {
    const dayStart = MOCK_NOW - dayIndex * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    let submitted = 0;
    let approved = 0;
    let overdue = 0;

    for (const assignment of assignments) {
      const withinDay = assignment.lastActivityAt >= dayStart && assignment.lastActivityAt < dayEnd;
      if (!withinDay) continue;
      if (assignment.status === 'Submitted' || assignment.status === 'InReview') submitted += 1;
      else if (assignment.status === 'Approved') approved += 1;
      else if (assignment.status === 'Overdue') overdue += 1;
    }

    points.push({
      dateLabel: RU_DATE_FMT.format(dayStart),
      submitted,
      approved,
      overdue,
    });
  }

  return points;
}

export interface RoleDistribution {
  admins: number;
  leads: number;
  mentors: number;
}

export function computeRoleDistribution(scope: ScopeFilter): RoleDistribution {
  const users = usersInScope(scope);
  return {
    admins: users.filter((u) => u.role === 'Admin').length,
    leads: users.filter((u) => u.role === 'Lead').length,
    mentors: users.filter((u) => u.role === 'Mentor').length,
  };
}

export interface BranchHealthRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  isHeadOffice: boolean;
  isActive: boolean;
  categoriesCount: number;
  mentorsCount: number;
  activeAssignments: number;
  pendingReview: number;
  healthPct: number;
  hasActiveAdmin: boolean;
}

export function computeBranchHealthRows(): BranchHealthRow[] {
  return BRANCHES.map((branch) => {
    const categories = categoriesOfBranch(branch.id);
    const assignments = filterAssignments({ branchId: branch.id });
    const mentorsCount = db.users.filter(
      (u) => u.branchId === branch.id && u.role === 'Mentor' && u.isActive,
    ).length;
    const active = assignments.filter((a) => ACTIVE_STATUSES.has(a.status)).length;
    const pending = assignments.filter((a) => PENDING_REVIEW_STATUSES.has(a.status)).length;
    const overdue = assignments.filter((a) => a.status === 'Overdue').length;
    const workingTotal = assignments.filter((a) => !NON_WORKING_STATUSES.has(a.status)).length;
    const healthPct = workingTotal === 0 ? 100 : Math.round(100 - (overdue / workingTotal) * 100);
    const hasActiveAdmin = db.users.some(
      (u) => u.branchId === branch.id && u.role === 'Admin' && u.adminScope === 'Branch' && u.isActive,
    );

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      isHeadOffice: branch.isHeadOffice,
      isActive: branch.isActive,
      categoriesCount: categories.length,
      mentorsCount,
      activeAssignments: active,
      pendingReview: pending,
      healthPct,
      hasActiveAdmin,
    };
  });
}

export interface CategoryHealthRow {
  categoryId: string;
  categoryName: string;
  branchId: string;
  branchName: string;
  colorToken: 'indigo' | 'blue' | 'cyan';
  isActive: boolean;
  leadName: string | null;
  mentorsCount: number;
  activeAssignments: number;
  pendingReview: number;
  healthPct: number;
}

export function computeCategoryHealthRows(branchId: string | null): CategoryHealthRow[] {
  const categories = branchId === null ? CATEGORIES : categoriesOfBranch(branchId);

  return categories.map((category) => {
    const assignments = filterAssignments({ branchId: category.branchId, categoryId: category.id });
    const lead = db.users.find(
      (u) => u.categoryId === category.id && u.role === 'Lead' && u.isActive,
    );
    const mentorsCount = db.users.filter(
      (u) => u.categoryId === category.id && u.role === 'Mentor' && u.isActive,
    ).length;
    const active = assignments.filter((a) => ACTIVE_STATUSES.has(a.status)).length;
    const pending = assignments.filter((a) => PENDING_REVIEW_STATUSES.has(a.status)).length;
    const overdue = assignments.filter((a) => a.status === 'Overdue').length;
    const workingTotal = assignments.filter((a) => !NON_WORKING_STATUSES.has(a.status)).length;
    const healthPct = workingTotal === 0 ? 100 : Math.round(100 - (overdue / workingTotal) * 100);
    const branch = findBranch(category.branchId);

    return {
      categoryId: category.id,
      categoryName: category.name,
      branchId: category.branchId,
      branchName: branch?.name ?? '—',
      colorToken: category.colorToken,
      isActive: category.isActive,
      leadName: lead?.fullName ?? null,
      mentorsCount,
      activeAssignments: active,
      pendingReview: pending,
      healthPct,
    };
  });
}

export interface MentorWorkloadRow {
  mentorId: string;
  mentorName: string;
  active: number;
  approved: number;
  overdue: number;
}

const MIN_SAMPLE_SIZE = 5;

export function computeMentorWorkload(scope: ScopeFilter): MentorWorkloadRow[] {
  const mentors = usersInScope(scope).filter((u) => u.role === 'Mentor' && u.isActive);
  return mentors
    .map((mentor) => {
      const own = allAssignments().filter((a) => a.assignedToId === mentor.id);
      return {
        mentorId: mentor.id,
        mentorName: mentor.fullName,
        active: own.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
        approved: own.filter((a) => a.status === 'Approved').length,
        overdue: own.filter((a) => a.status === 'Overdue').length,
      };
    })
    .sort((a, b) => b.active - a.active);
}

/** ТЗ ANA-012: обезличенный показатель доступен только при выборке ≥5 менторов. */
export function meetsSampleSizeThreshold(scope: ScopeFilter): boolean {
  return usersInScope(scope).filter((u) => u.role === 'Mentor' && u.isActive).length >= MIN_SAMPLE_SIZE;
}

export interface ScopeMetrics {
  overdueRatePct: number | null;
  firstPassApprovalRatePct: number | null;
  completionRatePct: number | null;
  medianReviewHours: number | null;
  totalAssignments: number;
}

export function computeScopeMetrics(scope: ScopeFilter): ScopeMetrics {
  const assignments = filterAssignments(scope).filter((a) => !NON_WORKING_STATUSES.has(a.status));
  const total = assignments.length;
  if (total === 0) {
    return {
      overdueRatePct: null,
      firstPassApprovalRatePct: null,
      completionRatePct: null,
      medianReviewHours: null,
      totalAssignments: 0,
    };
  }

  const overdue = assignments.filter((a) => a.status === 'Overdue').length;
  const approved = assignments.filter((a) => a.status === 'Approved').length;
  const firstPass = assignments.filter((a) => a.status === 'Approved' && !a.isLate).length;

  return {
    overdueRatePct: Math.round((overdue / total) * 1000) / 10,
    firstPassApprovalRatePct: approved === 0 ? null : Math.round((firstPass / approved) * 1000) / 10,
    completionRatePct: Math.round((approved / total) * 1000) / 10,
    medianReviewHours: 6.5,
    totalAssignments: total,
  };
}

export function categoryLabel(categoryId: string): string {
  return findCategory(categoryId)?.name ?? categoryId;
}
