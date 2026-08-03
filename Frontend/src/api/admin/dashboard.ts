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

export interface DashboardResponse {
  scope: { branchId: string | null; isAllBranches: boolean };
  kpis: DashboardKpis;
  activitySeries: ActivityPoint[];
  roleDistribution: RoleDistribution;
  branchHealth: BranchHealthRow[] | null;
  categoryHealth: CategoryHealthRow[];
  recentAudit: AuditLogEntryDto[];
  systemHealth: { services: ServiceHealthDto[]; recentEvents: SystemEventDto[] };
}

export async function getDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/api/v1/admin/dashboard');
  return data;
}
