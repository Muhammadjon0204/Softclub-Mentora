import type { AuthUser } from './auth';
import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Users/AvatarDtos.cs`. */
export interface UserAvatarEntry {
  userId: string;
  avatarUrl: string;
}

/**
 * Справочник фотографий организации. Живой ключ (не `auth`): realtime-событие
 * `user` помечает его устаревшим, и новое фото появляется на всех экранах сразу.
 */
export const AVATAR_DIRECTORY_QUERY_KEY = ['people', 'avatars'] as const;

export async function getAvatarDirectory(): Promise<UserAvatarEntry[]> {
  const { data } = await apiClient.get<UserAvatarEntry[]>('/api/v1/users/avatars');
  return data;
}

/** PUT /auth/me/avatar — уже обрезанный квадрат WebP/JPEG; ответ — обновлённый профиль. */
export async function uploadAvatar(image: Blob, onProgress?: (fraction: number) => void): Promise<AuthUser> {
  const form = new FormData();
  form.append('file', image, image.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');

  const { data } = await apiClient.put<AuthUser>('/api/v1/auth/me/avatar', form, {
    // У клиента по умолчанию стоит JSON; для формы axios сам допишет boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress !== undefined && event.total !== undefined && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    },
  });
  return data;
}

/** DELETE /auth/me/avatar — обратно к инициалам. */
export async function removeAvatar(): Promise<AuthUser> {
  const { data } = await apiClient.delete<AuthUser>('/api/v1/auth/me/avatar');
  return data;
}
