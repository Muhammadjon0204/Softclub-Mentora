import { useSyncExternalStore } from 'react';

import type { AuthUser } from './api';
import { secureStorage } from './secureStorage';

/** A team the person belongs to, as `GET /auth/me` lists it. */
export interface Team {
  categoryId: string;
  name: string;
  timeZoneId: string;
  /** What they are in this team: `Lead`, `Mentor` or `Member`. */
  role: string;
  /** The team the account opens in by itself — no header needed. */
  isMain: boolean;
  permissions: string[];
}

/**
 * The team a person is working in — the site's switcher. `null` is «as the account is»: the main team,
 * or the administrator's own sections. Not a security boundary: the server checks on every request
 * that they belong to the team the header names.
 */
let active: string | null = null;
const listeners = new Set<() => void>();

export function getActiveTeam(): string | null {
  return active;
}

export function setActiveTeam(next: string | null): void {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener());
}

export function useActiveTeam(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => active,
    () => active,
  );
}

/** The header for a request. Sign-in and the profile belong to the account, not to a team. */
export function teamHeader(path: string): Record<string, string> {
  return active && !path.startsWith('/api/v1/auth/') ? { 'X-MTF-Team-Id': active } : {};
}

/** Every team except the one the account opens in. */
export function switchableTeams(account: AuthUser): Team[] {
  return (account.teams ?? []).filter((team) => !team.isMain);
}

/**
 * The profile as the screens see it while working in a team: its role there, its permissions. A
 * participant uses the same screens as a mentor — they receive work and hand it in.
 */
export function userInTeam(account: AuthUser, teamId: string | null): AuthUser {
  const team = switchableTeams(account).find((candidate) => candidate.categoryId === teamId);
  if (!team) {
    return { ...account, teamRole: account.teams?.find((candidate) => candidate.isMain)?.role };
  }
  return {
    ...account,
    role: team.role === 'Lead' ? 'Lead' : 'Mentor',
    adminScope: null,
    category: { id: team.categoryId, name: team.name },
    permissions: team.permissions,
    teamRole: team.role,
  };
}

const key = (userId: string) => `ravand.team.${userId}`;

export const rememberedTeam = (userId: string): Promise<string | null> => secureStorage.get(key(userId)).catch(() => null);

export function rememberTeam(userId: string, teamId: string | null): void {
  const saved = teamId ? secureStorage.set(key(userId), teamId) : secureStorage.remove(key(userId));
  // Losing the preference only means starting in the main team next time.
  saved.catch(() => undefined);
}
