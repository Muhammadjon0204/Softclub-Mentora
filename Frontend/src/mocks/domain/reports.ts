import { db } from '../db';
import { allAssignments, type MockAssignment, type AssignmentStatus } from './assignments';
import { BRANCHES, CATEGORIES, categoriesOfBranch, findBranch, findCategory } from './organization';
import { DAY_MS, MOCK_NOW } from './reference';

export interface ScopeFilter {
  /** `null` — режим «Все филиалы» (только Organization Admin, только чтение). */
  branchId: string | null;
  categoryId?: string;
}

/**
 * Аналитический период Dashboard (полироль, раздел 4–7). Совпадает по значениям
 * с `features/admin-dashboard/dashboardPeriod.ts`, но не импортируется оттуда —
 * mocks-слой намеренно не зависит от frontend-feature кода (тот же принцип, что
 * и у остальных типов в этом файле: контракт дублируется, а не шарится напрямую).
 */
export type ReportPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

const PERIOD_DAYS: Record<ReportPeriod, number | null> = {
  all: null,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

function periodStart(period: ReportPeriod): number | null {
  const days = PERIOD_DAYS[period];
  return days === null ? null : MOCK_NOW - days * DAY_MS;
}

function periodEnd(period: ReportPeriod): number | null {
  const days = PERIOD_DAYS[period];
  return days === null ? null : MOCK_NOW + days * DAY_MS;
}

/** Обратное окно («что происходило за последние N дней») — для рейтингов и ленты активности. */
function withinBackwardWindow(timestampMs: number, period: ReportPeriod): boolean {
  const start = periodStart(period);
  return start === null || timestampMs >= start;
}

/** Прямое окно («что наступит в течение следующих N дней») — только для дедлайнов. */
function withinForwardWindow(timestampMs: number, period: ReportPeriod): boolean {
  const end = periodEnd(period);
  return end === null || timestampMs <= end;
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

/** Стабильный (не Math.random) псевдослучайный индекс дня из id — без завязки на реальный часовой пояс/время суток. */
function stableDayIndex(seed: string, days: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % days;
}

interface PeriodChartConfig {
  pointCount: number;
  granularity: 'day' | 'month';
}

/** Количество и грануляция точек X-axis по выбранному периоду (раздел 7 полироли). */
const PERIOD_CHART_CONFIG: Record<ReportPeriod, PeriodChartConfig> = {
  '1m': { pointCount: 10, granularity: 'day' },
  '3m': { pointCount: 12, granularity: 'day' },
  '6m': { pointCount: 6, granularity: 'month' },
  '1y': { pointCount: 12, granularity: 'month' },
  all: { pointCount: 12, granularity: 'month' },
};

const RU_MONTH_FMT = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** `all` визуально показан на том же 12-месячном окне, что и `1y` — реальных данных старше ~35 дней в mock нет, дальше окно физического смысла не меняет. */
function periodBucketDates(period: ReportPeriod): { date: number; label: string }[] {
  const config = PERIOD_CHART_CONFIG[period];
  const totalDays = PERIOD_DAYS[period] ?? PERIOD_DAYS['1y']!;
  const points: { date: number; label: string }[] = [];

  if (config.granularity === 'day') {
    for (let i = config.pointCount - 1; i >= 0; i -= 1) {
      const dayOffset = Math.round((i / (config.pointCount - 1)) * totalDays);
      const date = MOCK_NOW - dayOffset * DAY_MS;
      points.push({ date, label: RU_DATE_FMT.format(date) });
    }
    return points;
  }

  const now = new Date(MOCK_NOW);
  for (let i = config.pointCount - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(now);
    bucketDate.setDate(1);
    bucketDate.setMonth(bucketDate.getMonth() - i);
    points.push({ date: bucketDate.getTime(), label: RU_MONTH_FMT.format(bucketDate) });
  }
  return points;
}

/**
 * Бакетинг идёт не по реальному `lastActivityAt` (у ВСЕХ активных заданий это
 * поле лежит в последних 6 часах от `MOCK_NOW` — см. `buildForCategory` в
 * `domain/assignments.ts`, иначе серия «Отправлено» схлопывается в один пик),
 * а по стабильному хэшу id задания в диапазон точек текущего периода — тот же
 * приём, что и раньше, теперь параметризован количеством точек периода.
 */
export function computeActivitySeries(scope: ScopeFilter, period: ReportPeriod): ActivityPoint[] {
  const bucketDates = periodBucketDates(period);
  const pointCount = bucketDates.length;
  const assignments = filterAssignments(scope).filter((a) => withinBackwardWindow(a.lastActivityAt, period));

  const buckets: { submitted: number; approved: number; overdue: number }[] = Array.from(
    { length: pointCount },
    () => ({ submitted: 0, approved: 0, overdue: 0 }),
  );

  for (const assignment of assignments) {
    if (assignment.status === 'Submitted' || assignment.status === 'InReview' || assignment.status === 'NeedsRework') {
      buckets[stableDayIndex(assignment.id, pointCount)].submitted += 1;
    } else if (assignment.status === 'Approved') {
      buckets[stableDayIndex(`${assignment.id}:approved`, pointCount)].approved += 1;
    } else if (assignment.status === 'Overdue') {
      buckets[stableDayIndex(`${assignment.id}:overdue`, pointCount)].overdue += 1;
    }
  }

  return bucketDates.map((bucket, index) => ({
    dateLabel: bucket.label,
    submitted: buckets[index].submitted,
    approved: buckets[index].approved,
    overdue: buckets[index].overdue,
  }));
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

export interface PerformanceMetrics {
  /** Одобрено / рабочие задания. */
  completionRatePct: number;
  /** Доля рабочих заданий, ни разу не помеченных `isLate`. */
  onTimeRatePct: number;
  /** Одобрено без опоздания / всего одобрено — `null`, если одобренных нет (не 0, чтобы не создавать ложный «0%»). */
  firstPassApprovalRatePct: number | null;
  approvedCount: number;
  workingTotal: number;
}

function computePerformanceMetrics(assignments: MockAssignment[]): PerformanceMetrics {
  const working = assignments.filter((a) => !NON_WORKING_STATUSES.has(a.status));
  const workingTotal = working.length;
  const approved = working.filter((a) => a.status === 'Approved');
  const approvedCount = approved.length;
  const lateCount = working.filter((a) => a.isLate).length;
  const firstPass = approved.filter((a) => !a.isLate).length;

  return {
    completionRatePct: workingTotal === 0 ? 0 : Math.round((approvedCount / workingTotal) * 100),
    onTimeRatePct: workingTotal === 0 ? 100 : Math.round(((workingTotal - lateCount) / workingTotal) * 100),
    firstPassApprovalRatePct: approvedCount === 0 ? null : Math.round((firstPass / approvedCount) * 100),
    approvedCount,
    workingTotal,
  };
}

/**
 * Preview-индекс эффективности (раздел 13 полироли): completion×0.40 +
 * onTime×0.35 + firstPassApproval×0.25. Если одобренных заданий ещё нет,
 * firstPassApproval выпадает из формулы, а вес нормализуется на оставшиеся
 * два компонента — не «официальный» продуктовый KPI, только preview.
 */
function weightedPerformanceScore(metrics: PerformanceMetrics): number {
  const parts: { value: number; weight: number }[] = [
    { value: metrics.completionRatePct, weight: 0.4 },
    { value: metrics.onTimeRatePct, weight: 0.35 },
  ];
  if (metrics.firstPassApprovalRatePct !== null) {
    parts.push({ value: metrics.firstPassApprovalRatePct, weight: 0.25 });
  }
  const weightTotal = parts.reduce((sum, p) => sum + p.weight, 0);
  if (weightTotal === 0) return 0;
  const raw = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / weightTotal;
  return Math.max(0, Math.min(100, Math.round(raw)));
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
  /** «Лучшие команды» (раздел 17 полироли) ранжируются и показываются по этому полю, не по healthPct. */
  completionRatePct: number;
  onTimeRatePct: number;
  approvedCount: number;
}

export function computeCategoryHealthRows(branchId: string | null, period: ReportPeriod): CategoryHealthRow[] {
  const categories = branchId === null ? CATEGORIES : categoriesOfBranch(branchId);

  return categories.map((category) => {
    const allCategoryAssignments = filterAssignments({ branchId: category.branchId, categoryId: category.id });
    const periodAssignments = allCategoryAssignments.filter((a) => withinBackwardWindow(a.lastActivityAt, period));
    const lead = db.users.find(
      (u) => u.categoryId === category.id && u.role === 'Lead' && u.isActive,
    );
    const mentorsCount = db.users.filter(
      (u) => u.categoryId === category.id && u.role === 'Mentor' && u.isActive,
    ).length;
    const active = periodAssignments.filter((a) => ACTIVE_STATUSES.has(a.status)).length;
    const pending = periodAssignments.filter((a) => PENDING_REVIEW_STATUSES.has(a.status)).length;
    const overdue = periodAssignments.filter((a) => a.status === 'Overdue').length;
    const metrics = computePerformanceMetrics(periodAssignments);
    const healthPct = metrics.workingTotal === 0 ? 100 : Math.round(100 - (overdue / metrics.workingTotal) * 100);
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
      completionRatePct: metrics.completionRatePct,
      onTimeRatePct: metrics.onTimeRatePct,
      approvedCount: metrics.approvedCount,
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

/**
 * Executive Dashboard insights (раздел 3 сессии полировки /admin/dashboard) —
 * агрегаты, которых не было в исходном контракте: лучший филиал, топ менторов,
 * ближайшие дедлайны и «человеческая» лента активности по заданиям. Все числа
 * считаются от тех же `db.users` / `allAssignments()`, что и остальной отчёт —
 * никакого параллельного набора данных.
 */

export interface BranchInsightSummary {
  branchId: string;
  branchName: string;
  activeAssignments: number;
  approvedCount: number;
  mentorsCount: number;
  /** Preview-индекс эффективности: completion×0.40 + onTime×0.35 + firstPassApproval×0.25 — см. `weightedPerformanceScore`. */
  performanceScore: number;
  onTimeRatePct: number;
}

function branchInsightSummary(branchId: string, period: ReportPeriod): BranchInsightSummary {
  const branch = findBranch(branchId);
  const periodAssignments = filterAssignments({ branchId }).filter((a) => withinBackwardWindow(a.lastActivityAt, period));
  const metrics = computePerformanceMetrics(periodAssignments);

  return {
    branchId,
    branchName: branch?.name ?? branchId,
    activeAssignments: periodAssignments.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
    approvedCount: metrics.approvedCount,
    mentorsCount: db.users.filter((u) => u.branchId === branchId && u.role === 'Mentor' && u.isActive).length,
    performanceScore: weightedPerformanceScore(metrics),
    onTimeRatePct: metrics.onTimeRatePct,
  };
}

export interface BestBranchInsight extends BranchInsightSummary {
  /** `best-of-all` — сравнение всех филиалов (только Organization Admin + «Все филиалы»).
   *  `single-branch` — карточка не «филиал против остальных», а просто показатели текущего скоупа. */
  mode: 'best-of-all' | 'single-branch';
}

/**
 * Лучший = наивысший performanceScore. При равенстве (раздел 13 полироли,
 * чтобы не получить два «100» без объяснения): 1) больше approvedCount,
 * 2) выше onTimeRatePct, 3) стабильный алфавитный fallback по имени филиала.
 * Никакого Math.random.
 */
export function computeBestBranchInsight(scope: ScopeFilter, isAllBranches: boolean, period: ReportPeriod): BestBranchInsight {
  if (isAllBranches) {
    const summaries = BRANCHES.map((branch) => branchInsightSummary(branch.id, period));
    const best = summaries.reduce((leader, candidate) => {
      if (candidate.performanceScore !== leader.performanceScore) {
        return candidate.performanceScore > leader.performanceScore ? candidate : leader;
      }
      if (candidate.approvedCount !== leader.approvedCount) {
        return candidate.approvedCount > leader.approvedCount ? candidate : leader;
      }
      if (candidate.onTimeRatePct !== leader.onTimeRatePct) {
        return candidate.onTimeRatePct > leader.onTimeRatePct ? candidate : leader;
      }
      return candidate.branchName.localeCompare(leader.branchName, 'ru') < 0 ? candidate : leader;
    });
    return { ...best, mode: 'best-of-all' };
  }

  const branchId = scope.branchId ?? BRANCHES[0].id;
  return { ...branchInsightSummary(branchId, period), mode: 'single-branch' };
}

export interface TopMentorRow {
  mentorId: string;
  mentorName: string;
  categoryName: string | null;
  approved: number;
  active: number;
}

/**
 * Ранжирование по количеству одобренных заданий за выбранный период — реальная,
 * уже посчитанная величина (не выдуманный композитный «рейтинг эффективности»).
 * При равенстве approved: 1) больше активных заданий, 2) стабильный алфавитный fallback.
 */
export function computeTopMentors(scope: ScopeFilter, limit: number, period: ReportPeriod): TopMentorRow[] {
  const mentors = usersInScope(scope).filter((u) => u.role === 'Mentor' && u.isActive);
  return mentors
    .map((mentor) => {
      const own = allAssignments().filter(
        (a) => a.assignedToId === mentor.id && withinBackwardWindow(a.lastActivityAt, period),
      );
      return {
        mentorId: mentor.id,
        mentorName: mentor.fullName,
        categoryName: mentor.categoryId !== null ? (findCategory(mentor.categoryId)?.name ?? null) : null,
        approved: own.filter((a) => a.status === 'Approved').length,
        active: own.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
      };
    })
    .sort((a, b) => b.approved - a.approved || b.active - a.active || a.mentorName.localeCompare(b.mentorName, 'ru'))
    .slice(0, limit);
}

export interface UpcomingDeadlineRow {
  id: string;
  title: string;
  mentorName: string;
  dueAt: number;
}

const UPCOMING_DEADLINE_STATUSES = new Set<AssignmentStatus>(['Assigned', 'Submitted', 'InReview', 'NeedsRework']);

/**
 * Только ещё не просроченные задания с `currentDueAt` в будущем, отсортированы
 * по близости срока. Период здесь — окно ВПЕРЁД («сроки в течение следующих N
 * дней»), а не назад, как у остальных рейтингов — семантика «предстоящих
 * дедлайнов» иначе не имеет смысла.
 */
export function computeUpcomingDeadlines(scope: ScopeFilter, limit: number, period: ReportPeriod): UpcomingDeadlineRow[] {
  return filterAssignments(scope)
    .filter(
      (a) =>
        UPCOMING_DEADLINE_STATUSES.has(a.status) &&
        a.currentDueAt > MOCK_NOW &&
        withinForwardWindow(a.currentDueAt, period),
    )
    .sort((a, b) => a.currentDueAt - b.currentDueAt)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.topicTitle,
      mentorName: db.users.find((u) => u.id === a.assignedToId)?.fullName ?? '—',
      dueAt: a.currentDueAt,
    }));
}

export type RecentAssignmentActivityStatus = 'Assigned' | 'Submitted' | 'InReview' | 'NeedsRework' | 'Overdue' | 'Approved';

export interface RecentAssignmentActivityRow {
  id: string;
  at: number;
  mentorName: string;
  leadName: string | null;
  categoryName: string;
  title: string;
  status: RecentAssignmentActivityStatus;
}

const RECENT_ACTIVITY_STATUSES = new Set<AssignmentStatus>([
  'Assigned',
  'Submitted',
  'InReview',
  'NeedsRework',
  'Overdue',
  'Approved',
]);

/**
 * «Последняя активность» бизнес-фактов по заданиям — сырые данные, без готового
 * предложения на русском (форматирование в human-readable текст — frontend,
 * `dashboardFormatters.ts`, раздел 16 промпта), но 100% из реальных записей
 * `allAssignments()`: заголовок, ментор (assignedToId) и лид (assignedById).
 */
export function computeRecentAssignmentActivity(scope: ScopeFilter, limit: number, period: ReportPeriod): RecentAssignmentActivityRow[] {
  return filterAssignments(scope)
    .filter(
      (a): a is typeof a & { status: RecentAssignmentActivityStatus } =>
        RECENT_ACTIVITY_STATUSES.has(a.status) && withinBackwardWindow(a.lastActivityAt, period),
    )
    .slice()
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      at: a.lastActivityAt,
      mentorName: db.users.find((u) => u.id === a.assignedToId)?.fullName ?? '—',
      leadName: a.assignedById !== null ? (db.users.find((u) => u.id === a.assignedById)?.fullName ?? null) : null,
      categoryName: findCategory(a.categoryId)?.name ?? '—',
      title: a.topicTitle,
      status: a.status,
    }));
}
