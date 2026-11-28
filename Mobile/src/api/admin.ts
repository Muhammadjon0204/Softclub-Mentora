import { apiGet, apiSend, type Paged } from '@/lib/api';

/** `GET /admin/dashboard` — the parts the phone shows (`Contracts/Admin/Dashboard/DashboardDtos.cs`). */
export type DashboardPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

export interface Dashboard {
  kpis: {
    totalUsers: number;
    activeMentors: number;
    activeAssignments: number;
    pendingReview: number;
    totalUsersDeltaPct: number;
    activeMentorsDeltaPct: number;
    activeAssignmentsDeltaPct: number;
    pendingReviewDeltaPct: number;
  };
  activitySeries: { dateLabel: string; submitted: number; approved: number; overdue: number }[];
  roleDistribution: { admins: number; leads: number; mentors: number };
  branchHealth?: { branchId: string; branchName: string; healthPct: number; activeAssignments: number; pendingReview: number; mentorsCount: number }[] | null;
  categoryHealth: {
    categoryId: string;
    categoryName: string;
    branchName: string;
    leadName?: string | null;
    mentorsCount: number;
    activeAssignments: number;
    pendingReview: number;
    healthPct: number;
    completionRatePct: number;
    onTimeRatePct: number;
  }[];
  topMentors: { mentorId: string; mentorName: string; categoryName?: string | null; approved: number; active: number }[];
  upcomingDeadlines: { id: string; title: string; mentorName: string; dueAt: string }[];
  recentAssignmentActivity: { id: string; at: string; mentorName: string; categoryName: string; title: string; status: string }[];
  systemHealth: {
    services: { id: string; name: string; status: string; latencyMs: number; lastCheckedAt: string; message: string }[];
    recentEvents: { id: string; at: string; level: string; message: string }[];
  };
}

export const getDashboard = (period: DashboardPeriod) => apiGet<Dashboard>(`/api/v1/admin/dashboard?period=${period}`);

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  actorType: string;
  actorId?: string | null;
  actorRole?: string | null;
  actorAdminScope?: string | null;
  result: string;
  failureReason?: string | null;
  occurredAt: string;
}

export const listAudit = (page: number) => apiGet<Paged<AuditEntry>>(`/api/v1/admin/audit-log?page=${page}&pageSize=30`);

export interface Notification {
  id: string;
  userId: string;
  eventType: string;
  channel: string;
  status: string;
  attempts: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export const listNotifications = (page: number, status: string) =>
  apiGet<Paged<Notification>>(`/api/v1/admin/notifications?page=${page}&pageSize=30${status ? `&status=${status}` : ''}`);

export const retryNotification = (id: string) => apiSend<Notification>('POST', `/api/v1/admin/notifications/${id}/retry`);

export interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isHeadOffice: boolean;
}

export const listBranches = () => apiGet<Paged<Branch>>('/api/v1/branches?pageSize=100');

export interface PermissionRow {
  key: string;
  group: string;
  roleValue: boolean;
  override?: boolean | null;
  effective: boolean;
}

export interface UserPermissions {
  userId: string;
  fullName: string;
  role: string;
  canEdit: boolean;
  permissions: PermissionRow[];
}

export interface PermissionException {
  userId: string;
  fullName: string;
  role: string;
  branchName?: string | null;
  categoryName?: string | null;
  allowed: string[];
  denied: string[];
}

export const getUserPermissions = (userId: string) => apiGet<UserPermissions>(`/api/v1/permissions/users/${userId}`);
export const listPermissionExceptions = () => apiGet<PermissionException[]>('/api/v1/permissions/exceptions');
export const setUserPermissions = (userId: string, changes: { permission: string; allowed: boolean | null }[], branchId?: string | null) =>
  apiSend<UserPermissions>('PUT', `/api/v1/permissions/users/${userId}`, { changes }, branchId);
