import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '../auth/useAuth';
import { connect, createRefetchScheduler } from './realtimeConnection';

/**
 * Держит одно realtime-соединение на вкладку, пока пользователь вошёл, и по
 * событиям сервера обновляет видимые данные без перезагрузки страницы.
 */
export function RealtimeSync(): null {
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;

  useEffect(() => {
    if (userId === null) return undefined;

    const scheduler = createRefetchScheduler(queryClient);
    const disconnect = connect(import.meta.env.VITE_API_BASE_URL ?? '', scheduler.schedule);

    return () => {
      disconnect();
      scheduler.dispose();
    };
  }, [queryClient, userId]);

  return null;
}
