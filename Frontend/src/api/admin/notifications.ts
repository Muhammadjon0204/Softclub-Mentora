import { apiClient } from '../client';

/** `Backend/src/MentorTaskFlow.Contracts/Notifications/NotificationDtos.cs`. */
export interface NotificationDto {
  id: string;
  userId: string;
  branchId: string | null;
  categoryId: string | null;
  eventType: string;
  channel: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  sentAt: string | null;
  lastError: string | null;
  isSystemAlert: boolean;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  channel?: string;
  eventType?: string;
  userId?: string;
}

function toQueryParams(query: NotificationListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.pageSize !== undefined) params.pageSize = query.pageSize;
  if (query.status !== undefined) params.status = query.status;
  if (query.channel !== undefined) params.channel = query.channel;
  if (query.eventType !== undefined) params.eventType = query.eventType;
  if (query.userId !== undefined) params.userId = query.userId;
  return params;
}

/** GET /admin/notifications — Admin only, scope-narrowed server-side (`NotificationAdminService.Visible`). */
export async function listNotifications(query: NotificationListQuery = {}): Promise<PagedResult<NotificationDto>> {
  const { data } = await apiClient.get<PagedResult<NotificationDto>>('/api/v1/admin/notifications', {
    params: toQueryParams(query),
  });
  return data;
}
