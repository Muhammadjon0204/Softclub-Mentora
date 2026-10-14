import type { AuthUser } from './auth';
import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Auth/ProfileContracts.cs`. */
export interface ChannelSwitches {
  email: boolean;
  telegram: boolean;
}

export interface NotificationPreferences {
  assignments: ChannelSwitches;
  deadlines: ChannelSwitches;
  reviews: ChannelSwitches;
  system: ChannelSwitches;
}

export type NotificationTopic = keyof NotificationPreferences;

export interface SessionsSummary {
  otherActiveSessions: number;
  lastLoginAt: string | null;
}

/** PATCH /auth/me — меняется только имя. */
export async function updateProfile(fullName: string): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>('/api/v1/auth/me', { fullName });
  return data;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<NotificationPreferences>('/api/v1/auth/me/notification-preferences');
  return data;
}

export async function updateNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const { data } = await apiClient.put<NotificationPreferences>('/api/v1/auth/me/notification-preferences', preferences);
  return data;
}

/** GET /auth/sessions — refresh-cookie (path `/api/v1/auth`) отличает текущую сессию от остальных. */
export async function getSessions(): Promise<SessionsSummary> {
  const { data } = await apiClient.get<SessionsSummary>('/api/v1/auth/sessions');
  return data;
}

export async function revokeOtherSessions(): Promise<{ revoked: number }> {
  const { data } = await apiClient.post<{ revoked: number }>('/api/v1/auth/sessions/revoke-others');
  return data;
}
