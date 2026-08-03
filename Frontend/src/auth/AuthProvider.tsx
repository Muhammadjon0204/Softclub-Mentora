import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { authApi, type AuthUser, type ChangePasswordRequest, type LoginRequest } from '../api/auth';
import { authEvents, sessionEndReasonFromError, type SessionEndReason } from './authEvents';
import {
  AUTH_ME_QUERY_KEY,
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './authContext';
// Импорт координатора обязателен: он регистрирует single-flight refresh в apiClient.
import { refreshAccessToken } from './refreshCoordinator';
import { clearAccessToken, getAccessToken, setAccessToken, subscribe } from './tokenStore';

interface AuthProviderProps {
  children: ReactNode;
}

const getServerSnapshot = (): string | null => null;

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [user, setUser] = useState<AuthUser | null>(null);

  const accessToken = useSyncExternalStore(subscribe, getAccessToken, getServerSnapshot);

  /** Полная локальная очистка. Сетевые вызовы сюда не входят. */
  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('anonymous');
    // В кэше могли осесть данные защищённых эндпоинтов — вычищаем целиком.
    queryClient.clear();
  }, [queryClient]);

  const fetchCurrentUser = useCallback(
    async (): Promise<AuthUser> =>
      queryClient.fetchQuery({
        queryKey: AUTH_ME_QUERY_KEY,
        queryFn: authApi.getMe,
        staleTime: Infinity,
        retry: false,
      }),
    [queryClient],
  );

  /* ---------------------------------------------------------------- */
  /* Bootstrap: refresh -> me                                          */
  /* ---------------------------------------------------------------- */

  const bootstrapRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        await refreshAccessToken();
        setUser(await fetchCurrentUser());
        setStatus('authenticated');
      } catch (error: unknown) {
        clearSession();

        // Обычное «сессии нет» на первом визите — молча. А вот компрометация
        // и провал CSRF должны быть видимы пользователю.
        const reason = sessionEndReasonFromError(error);
        if (reason !== 'session-expired') {
          navigate(`/login?reason=${reason}`, { replace: true });
        }
      }
    };

    // StrictMode в dev монтирует эффект дважды — второй раз переиспользуем промис.
    bootstrapRef.current ??= bootstrap();
  }, [clearSession, fetchCurrentUser, navigate]);

  /* ---------------------------------------------------------------- */
  /* Подписка на события auth-шины                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const endSession = (reason: SessionEndReason): void => {
      clearSession();
      navigate(`/login?reason=${reason}`, { replace: true });
    };

    const unsubscribers = [
      authEvents.on('sessionExpired', ({ reason }) => {
        endSession(reason);
      }),
      authEvents.on('tokenReuseDetected', () => {
        endSession('session-compromised');
      }),
      authEvents.on('loggedOut', () => {
        clearSession();
        navigate('/login', { replace: true });
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [clearSession, navigate]);

  /* ---------------------------------------------------------------- */
  /* Действия                                                          */
  /* ---------------------------------------------------------------- */

  const login = useCallback(
    async (credentials: LoginRequest): Promise<AuthUser> => {
      const result = await authApi.login(credentials);
      setAccessToken(result.accessToken);
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, result.user);
      setUser(result.user);
      setStatus('authenticated');
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Сервер мог ответить 403 или сеть отвалиться — локальную сессию всё равно закрываем.
    } finally {
      authEvents.emit('loggedOut', {});
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    await refreshAccessToken();
    setUser(await fetchCurrentUser());
    setStatus('authenticated');
  }, [fetchCurrentUser]);

  const changePassword = useCallback(
    async (payload: ChangePasswordRequest): Promise<void> => {
      const result = await authApi.changePassword(payload);
      // Прочие сессии сервер отозвал, текущей выдал новую пару.
      setAccessToken(result.accessToken);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken,
      user,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      logout,
      refreshSession,
      changePassword,
    }),
    [status, accessToken, user, login, logout, refreshSession, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
