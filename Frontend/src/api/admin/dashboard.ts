import { apiClient } from '../client';

/**
 * Контракт агрегирующего дашборда. Пока нет отдельного OpenAPI-документа admin-домена
 * (он появится вместе с полным Приложением D ТЗ 2.2) — форма зафиксирована здесь как
 * единственный источник истины для frontend и для мок-хендлера `mocks/handlers/dashboard.ts`.
 * При подключении реального backend меняется только реализация запроса, не эти типы.
 */

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

export interface ActivityPoint {
  dateLabel: string;
  submitted: number;
  approved: number;
  overdue: number;
}

export interface RoleDistribution {
  admins: number;
  leads: number;
  mentors: number;
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
  /** «Лучшие команды» ранжируются и показываются по этому полю, не по healthPct. */
  completionRatePct: number;
  onTimeRatePct: number;
  approvedCount: number;
}

export interface AuditLogEntryDto {
  id: string;
  at: string;
  branchId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  result: 'Success' | 'Failure';
}

export type ServiceStatus = 'Operational' | 'Degraded' | 'Unavailable';

export interface ServiceHealthDto {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  lastCheckedAt: string;
  message: string;
}

export interface SystemEventDto {
  id: string;
  at: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Executive Dashboard insights (полироль /admin/dashboard) — лучший филиал,
 * топ менторов, ближайшие дедлайны и сырые факты для human-readable ленты
 * активности. Форматирование в текст на русском — на фронтенде
 * (`features/admin-dashboard/dashboardFormatters.ts`), контракт отдаёт
 * только структурированные данные.
 */
export interface BestBranchInsight {
  /** `best-of-all` — сравнение всех филиалов; `single-branch` — показатели текущего скоупа без сравнения. */
  mode: 'best-of-all' | 'single-branch';
  branchId: string;
  branchName: string;
  activeAssignments: number;
  approvedCount: number;
  mentorsCount: number;
  /** Preview-индекс эффективности (completion/onTime/firstPassApproval) — не официальный продуктовый KPI. */
  performanceScore: number;
  onTimeRatePct: number;
}

export interface TopMentorRow {
  mentorId: string;
  mentorName: string;
  categoryName: string | null;
  approved: number;
  active: number;
}

export interface UpcomingDeadlineDto {
  id: string;
  title: string;
  mentorName: string;
  dueAt: string;
}

export type RecentAssignmentActivityStatus =
  | 'Assigned'
  | 'Submitted'
  | 'InReview'
  | 'NeedsRework'
  | 'Overdue'
  | 'Approved';

export interface RecentAssignmentActivityDto {
  id: string;
  at: string;
  mentorName: string;
  leadName: string | null;
  categoryName: string;
  title: string;
  status: RecentAssignmentActivityStatus;
}

/** Совпадает по значениям с `features/admin-dashboard/dashboardPeriod.ts` (тот же принцип дублирования контракта, что и у остальных типов файла). */
export type DashboardPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

export interface DashboardResponse {
  scope: { branchId: string | null; isAllBranches: boolean };
  period: DashboardPeriod;
  kpis: DashboardKpis;
  activitySeries: ActivityPoint[];
  roleDistribution: RoleDistribution;
  branchHealth: BranchHealthRow[] | null;
  categoryHealth: CategoryHealthRow[];
  recentAudit: AuditLogEntryDto[];
  systemHealth: { services: ServiceHealthDto[]; recentEvents: SystemEventDto[] };
  bestBranchInsight: BestBranchInsight;
  topMentors: TopMentorRow[];
  upcomingDeadlines: UpcomingDeadlineDto[];
  recentAssignmentActivity: RecentAssignmentActivityDto[];
}

export async function getDashboard(period: DashboardPeriod): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/api/v1/admin/dashboard', { params: { period } });
  return data;
}
