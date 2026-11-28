import type { Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { setCanOverrideBranch } from './branchScope';
import { apiGet, onSessionLost, onTeamLost, restoreSession, signIn as apiSignIn, signOut as apiSignOut, type AuthUser } from './api';
import { getActiveTeam, rememberedTeam, rememberTeam, setActiveTeam, switchableTeams, useActiveTeam, userInTeam } from './team';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: string | null }
  | { status: 'signedIn'; user: AuthUser };

interface SessionContextValue {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** The profile changed (name, permissions) — keep the new copy. */
  setUser: (user: AuthUser) => void;
  /** Work in another team; `null` goes back to the account's own. `then` is opened once there. */
  switchTeam: (teamId: string | null, then?: Href) => void;
  /** The screen asked for by the last switch, handed out once. */
  takeAfterSwitch: () => Href | null;
  /** True for the moment between two teams, while no signed-in screen may be on screen. */
  switching: boolean;
}

/** The team chosen last time on this phone, if the person is still in it — set before any screen loads. */
async function openTeam(user: AuthUser): Promise<void> {
  const remembered = await rememberedTeam(user.id);
  setActiveTeam(switchableTeams(user).some((team) => team.categoryId === remembered) ? remembered : null);
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const account = state.status === 'signedIn' ? state.user : null;

  // Two steps: first the screens of the old role leave, then the team changes. Otherwise they would
  // ask the server once more under the new team and be refused — or file the answer there.
  const [next, setNext] = useState<{ teamId: string | null } | null>(null);
  const afterSwitch = useRef<Href | null>(null);
  const switchTeam = useCallback((teamId: string | null, then?: Href) => {
    afterSwitch.current = then ?? null;
    setNext({ teamId });
  }, []);
  const takeAfterSwitch = useCallback(() => {
    const href = afterSwitch.current;
    afterSwitch.current = null;
    return href;
  }, []);
  const switching = next !== null;

  useEffect(() => {
    if (!next || !account) return undefined;
    const timer = setTimeout(() => {
      setActiveTeam(next.teamId);
      rememberTeam(account.id, next.teamId);
      setNext(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [next, account]);

  useEffect(() => {
    onTeamLost(() => {
      switchTeam(null);
      apiGet<AuthUser>('/api/v1/auth/me')
        .then((user) => setState({ status: 'signedIn', user }))
        .catch(() => undefined);
    });
  }, [switchTeam]);

  useEffect(() => {
    onSessionLost(() => {
      setState({ status: 'signedOut', notice: 'Сессия закончилась. Войдите снова.' });
    });

    restoreSession()
      .then(async (user) => {
        if (user) await openTeam(user);
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', notice: null });
      })
      .catch(() => {
        // No network at launch: show sign-in with a hint, the stored token is kept for the next try.
        setState({ status: 'signedOut', notice: 'Нет связи с сервером. Проверьте интернет.' });
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await apiSignIn(email, password);
    await openTeam(user);
    setState({ status: 'signedIn', user });
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setActiveTeam(null);
    setState({ status: 'signedOut', notice: null });
  }, []);

  const orgAdmin = state.status === 'signedIn' && state.user.role === 'Admin' && state.user.adminScope === 'Organization';
  useEffect(() => {
    setCanOverrideBranch(orgAdmin);
  }, [orgAdmin]);

  const setUser = useCallback((user: AuthUser) => {
    // A refreshed profile without the chosen team: stop naming it.
    if (!switchableTeams(user).some((team) => team.categoryId === getActiveTeam())) setActiveTeam(null);
    setState({ status: 'signedIn', user });
  }, []);
  const value = useMemo(
    () => ({ state, signIn, signOut, setUser, switchTeam, takeAfterSwitch, switching }),
    [state, signIn, signOut, setUser, switchTeam, takeAfterSwitch, switching],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession: нет SessionProvider');
  return value;
}

/** The account itself, whichever team the person is working in. */
export function useAccount(): AuthUser {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('useAccount: пользователь не вошёл');
  return state.user;
}

/**
 * Who the signed-in person is right now — the account, or their role in the chosen team; only for
 * screens behind the `(app)` guard.
 */
export function useUser(): AuthUser {
  const account = useAccount();
  const team = useActiveTeam();
  return useMemo(() => userInTeam(account, team), [account, team]);
}
