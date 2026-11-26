import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { onSessionLost, restoreSession, signIn as apiSignIn, signOut as apiSignOut, ApiError, type AuthUser } from './api';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: string | null }
  | { status: 'signedIn'; user: AuthUser };

interface SessionContextValue {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Only mentors for now; leads and admins keep using the site until their screens exist here. */
export const MOBILE_ROLES = ['Mentor'] as const;
const WRONG_ROLE = 'Приложение пока работает только для менторов. Лидам и администраторам — сайт RAVAND.';

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    onSessionLost(() => {
      setState({ status: 'signedOut', notice: 'Сессия закончилась. Войдите снова.' });
    });

    restoreSession()
      .then(async (user) => {
        if (user && !MOBILE_ROLES.includes(user.role as 'Mentor')) {
          await apiSignOut();
          setState({ status: 'signedOut', notice: WRONG_ROLE });
          return;
        }
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', notice: null });
      })
      .catch(() => {
        // No network at launch: show sign-in with a hint, the stored token is kept for the next try.
        setState({ status: 'signedOut', notice: 'Нет связи с сервером. Проверьте интернет.' });
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await apiSignIn(email, password);
    if (!MOBILE_ROLES.includes(user.role as 'Mentor')) {
      await apiSignOut();
      throw new ApiError(403, 'ROLE_NOT_SUPPORTED', WRONG_ROLE);
    }
    setState({ status: 'signedIn', user });
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setState({ status: 'signedOut', notice: null });
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession: нет SessionProvider');
  return value;
}

/** The signed-in user; only for screens behind the `(app)` guard. */
export function useUser(): AuthUser {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('useUser: пользователь не вошёл');
  return state.user;
}
