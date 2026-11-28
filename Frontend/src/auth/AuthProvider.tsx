import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { authApi, type AuthUser, type ChangePasswordRequest, type LoginRequest } from '../api/auth';
import {
  getActiveTeamId,
  rememberedTeamId,
  rememberTeamId,
  setActiveTeamId,
  subscribeActiveTeam,
} from './activeTeam';
import { authEvents, sessionEndReasonFromError, type SessionEndReason } from './authEvents';
import {
  AUTH_ME_QUERY_KEY,
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './authContext';
// Импорт координатора обязателен: он регистрирует single-flight refresh в apiClient.
import { refreshAccessToken } from './refreshCoordinator';
import { dashboardPathForRole } from './roleRedirect';
import { switchableTeams, teamForPath, userInTeam } from './teams';
import { clearAccessToken, getAccessToken, setAccessToken, subscribe } from './tokenStore';

interface AuthProviderProps {
  children: ReactNode;
}

const getServerSnapshot = (): string | null => null;

/** Публичные страницы, с которых bootstrap никого не уводит на /login. */
const PASSWORD_RECOVERY_PATHS = new Set(['/forgot-password', '/reset-password', '/set-password']);

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthStatus>('bootstrapping');
  const [account, setAccount] = useState<AuthUser | null>(null);

  const accessToken = useSyncExternalStore(subscribe, getAccessToken, getServerSnapshot);
  const activeTeamId = useSyncExternalStore(subscribeActiveTeam, getActiveTeamId, getServerSnapshot);
  const user = useMemo(
    () => (account === null ? null : userInTeam(account, activeTeamId)),
    [account, activeTeamId],
  );

  /** Первый профиль сессии: сначала выбирается команда, потом рисуются страницы. */
  const openSession = useCallback((next: AuthUser, path: string): AuthUser => {
    const teamId = teamForPath(next, path, rememberedTeamId(next.id));
    setActiveTeamId(teamId);
    setAccount(next);
    setStatus('authenticated');
    return userInTeam(next, teamId);
  }, []);

  /** Полная локальная очистка. Сетевые вызовы сюда не входят. */
  const clearSession = useCallback(() => {
    clearAccessToken();
    setActiveTeamId(null);
    setAccount(null);
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
        openSession(await fetchCurrentUser(), window.location.pathname + window.location.search);
      } catch (error: unknown) {
        clearSession();

        // Обычное «сессии нет» на первом визите — молча. А вот компрометация
        // и провал CSRF должны быть видимы пользователю — но не ценой страниц
        // восстановления пароля: человек, который забыл пароль и пришёл со
        // старыми cookie, иначе вообще не попадёт на форму сброса.
        const reason = sessionEndReasonFromError(error);
        if (reason !== 'session-expired' && !PASSWORD_RECOVERY_PATHS.has(window.location.pathname)) {
          navigate(`/login?reason=${reason}`, { replace: true });
        }
      }
    };

    // StrictMode в dev монтирует эффект дважды — второй раз переиспользуем промис.
    bootstrapRef.current ??= bootstrap();
  }, [clearSession, fetchCurrentUser, navigate, openSession]);

  /* ---------------------------------------------------------------- */
  /* Команды                                                           */
  /* ---------------------------------------------------------------- */

  const switchTeam = useCallback(
    (teamId: string | null, to?: string): void => {
      if (account === null) return;
      const next = userInTeam(account, teamId);
      // Всё, что уже загружено, принадлежит прежней команде.
      setActiveTeamId(next === account ? null : teamId);
      rememberTeamId(account.id, getActiveTeamId());
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_ME_QUERY_KEY[0] });
      navigate(to ?? dashboardPathForRole(next.role), { replace: to !== undefined });
    },
    [account, navigate, queryClient],
  );

  // Профиль обновился, а выбранной команды в нём больше нет — заголовок слать нельзя.
  useEffect(() => {
    if (account === null || activeTeamId === null) return;
    if (!switchableTeams(account).some((team) => team.categoryId === activeTeamId)) {
      switchTeam(null);
    }
  }, [account, activeTeamId, switchTeam]);

  useEffect(
    () =>
      authEvents.on('teamLost', () => {
        switchTeam(null);
        authApi.getMe().then(setAccount).catch(() => undefined);
      }),
    [switchTeam],
  );

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
    async (credentials: LoginRequest, requestedPath = '/'): Promise<AuthUser> => {
      setActiveTeamId(null);
      const result = await authApi.login(credentials);
      setAccessToken(result.accessToken);
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, result.user);
      return openSession(result.user, requestedPath);
    },
    [openSession, queryClient],
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
    setAccount(await fetchCurrentUser());
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

  const updateUser = useCallback(
    (next: AuthUser): void => {
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, next);
      setAccount(next);
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      accessToken,
      user,
      account,
      activeTeamId,
      switchTeam,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      logout,
      refreshSession,
      changePassword,
      updateUser,
    }),
    [status, accessToken, user, account, activeTeamId, switchTeam, login, logout, refreshSession, changePassword, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
