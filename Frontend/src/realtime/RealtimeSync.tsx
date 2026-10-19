import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { authApi } from '../api/auth';
import { useAuth } from '../auth/useAuth';
import { connect, createRefetchScheduler } from './realtimeConnection';

/**
 * Держит одно realtime-соединение на вкладку, пока пользователь вошёл, и по
 * событиям сервера обновляет видимые данные без перезагрузки страницы.
 */
export function RealtimeSync(): null {
  const queryClient = useQueryClient();
  const { status, user, updateUser } = useAuth();
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;

  // Через ref: смена ссылки на колбэк не должна пересоздавать соединение.
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  useEffect(() => {
    // With MSW mocks (tests, backend-less dev) there is no hub to connect to; trying would only
    // leave a retry loop running in the background.
    if (userId === null || import.meta.env.VITE_USE_MOCKS === 'true') return undefined;

    const scheduler = createRefetchScheduler(queryClient);
    const disconnect = connect(import.meta.env.VITE_API_BASE_URL ?? '', (change) => {
      scheduler.schedule();

      // Сессия (`auth/me`) в общий перезапрос не входит. Но если поменялся сам человек —
      // фото, имя — в другой вкладке или с телефона, шапку и профиль здесь тоже надо обновить.
      if (change?.kind === 'user' && change.id === userId) {
        authApi.getMe().then((next) => { updateUserRef.current(next); }).catch(() => undefined);
      }
    });

    return () => {
      disconnect();
      scheduler.dispose();
    };
  }, [queryClient, userId]);

  return null;
}
