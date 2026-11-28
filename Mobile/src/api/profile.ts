import { apiGet, apiSend, type AuthUser } from '@/lib/api';

export const updateName = (fullName: string) => apiSend<AuthUser>('PATCH', '/api/v1/auth/me', { fullName });
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiSend<unknown>('POST', '/api/v1/auth/change-password', { currentPassword, newPassword });

export interface Channels {
  email: boolean;
  telegram: boolean;
}
export interface NotificationPreferences {
  assignments: Channels;
  deadlines: Channels;
  reviews: Channels;
  system: Channels;
}

export const getPreferences = () => apiGet<NotificationPreferences>('/api/v1/auth/me/notification-preferences');
export const savePreferences = (p: NotificationPreferences) => apiSend<NotificationPreferences>('PUT', '/api/v1/auth/me/notification-preferences', p);

export const getTelegramStatus = () => apiGet<{ isBound: boolean; boundAt?: string | null }>('/api/v1/telegram/status');
export const createTelegramLink = () => apiSend<{ deepLink: string }>('POST', '/api/v1/telegram/bind-token');
export const testTelegram = () => apiSend<{ delivered: boolean; error?: string | null }>('POST', '/api/v1/telegram/test');
export const unbindTelegram = () => apiSend<void>('DELETE', '/api/v1/telegram/binding');
