import { useQuery } from '@tanstack/react-query';

import { AVATAR_DIRECTORY_QUERY_KEY, getAvatarDirectory, type UserAvatarEntry } from '../../api/avatars';
import { useAuth } from '../../auth/useAuth';

// Стабильная ссылка на select: React Query пересчитывает Map только при новых данных.
const toMap = (entries: UserAvatarEntry[]): ReadonlyMap<string, string> =>
  new Map(entries.map((entry) => [entry.userId, entry.avatarUrl]));

/**
 * Фото человека по id. Свой профиль берётся из сессии — он обновляется сразу
 * после загрузки, раньше справочника; остальные — из справочника организации,
 * который realtime держит свежим. Один запрос на всё приложение, сколько бы
 * аватарок ни было на экране.
 */
export function useAvatarUrl(userId: string | null | undefined): string | null {
  const { status, user } = useAuth();
  const { data } = useQuery({
    queryKey: AVATAR_DIRECTORY_QUERY_KEY,
    queryFn: getAvatarDirectory,
    select: toMap,
    staleTime: 5 * 60_000,
    enabled: status === 'authenticated',
  });

  if (userId === null || userId === undefined) return null;
  if (user !== null && user.id === userId) return user.avatarUrl ?? null;
  return data?.get(userId) ?? null;
}
