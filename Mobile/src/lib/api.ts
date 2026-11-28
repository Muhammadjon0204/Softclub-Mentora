import { branchHeader } from './branchScope';
import { API_URL } from './config';
import { secureStorage } from './secureStorage';
import { teamHeader, type Team } from './team';

/** `AuthUserDto` (`Backend/src/MentorTaskFlow.Contracts/Auth/AuthUserDto.cs`). */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'Admin' | 'Lead' | 'Mentor' | string;
  adminScope?: string | null;
  organization: { id: string; name: string };
  branch?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  avatarUrl?: string | null;
  /** What the owner has left open to this person; absent means «everything the role allows». */
  permissions?: string[] | null;
  /** Every team the person belongs to, the main one first. */
  teams?: Team[] | null;
  /** Set by the app, not the server: what the person is in the team they are working in. */
  teamRole?: string;
}

/** `MobileLoginResponse` — like the web login, plus the refresh token the app keeps in the Keychain. */
interface MobileLoginResponse {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** An RFC 7807 problem from the API: `code` is the machine-readable reason, `detail` is for people. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

const REFRESH_TOKEN_KEY = 'ravand.refreshToken';

/** The access token stays in memory only; it lives 15 minutes and is renewed from the refresh token. */
let accessToken: string | null = null;
let refreshing: Promise<AuthUser | null> | null = null;
let sessionLost: (() => void) | null = null;

/** The session provider learns here that the refresh token stopped working (revoked, expired). */
export function onSessionLost(listener: () => void): void {
  sessionLost = listener;
}

let teamLost: (() => void) | null = null;

/** …and here that the server no longer counts them in the team they were working in. */
export function onTeamLost(listener: () => void): void {
  teamLost = listener;
}

async function toApiError(response: Response): Promise<ApiError> {
  type Problem = { code?: unknown; detail?: unknown; title?: unknown };
  // Not JSON — a proxy page or an empty body — leaves only the status code to go on.
  const body = (await response.json().catch(() => null)) as Problem | null;
  const code = typeof body?.code === 'string' ? body.code : null;
  const message =
    (typeof body?.detail === 'string' && body.detail) ||
    (typeof body?.title === 'string' && body.title) ||
    `Сервер ответил ${response.status}`;
  return new ApiError(response.status, code, message);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Нет связи с сервером. Проверьте интернет.');
  }
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

async function keep(session: MobileLoginResponse): Promise<AuthUser> {
  accessToken = session.accessToken;
  await secureStorage.set(REFRESH_TOKEN_KEY, session.refreshToken);
  return session.user;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  return keep(await post<MobileLoginResponse>('/api/v1/auth/mobile/login', { email, password }));
}

/**
 * Exchanges the stored refresh token for a new pair. Concurrent callers share one request: the token
 * rotates on every use, and a second request with the old value would look like token theft
 * (`REFRESH_TOKEN_REUSE_DETECTED`) and sign the user out everywhere.
 */
export function restoreSession(): Promise<AuthUser | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await secureStorage.get(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      return await keep(await post<MobileLoginResponse>('/api/v1/auth/mobile/refresh', { refreshToken }));
    } catch (error) {
      // Only a definite «no» from the server ends the session; no network keeps the token for later.
      if (error instanceof ApiError && error.status === 401) {
        accessToken = null;
        await secureStorage.remove(REFRESH_TOKEN_KEY);
        return null;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function signOut(): Promise<void> {
  const refreshToken = await secureStorage.get(REFRESH_TOKEN_KEY);
  accessToken = null;
  await secureStorage.remove(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    // Best effort: the token is already gone from the phone; revoking it on the server is a bonus.
    await post('/api/v1/auth/mobile/logout', { refreshToken }).catch(() => undefined);
  }
}

/** An authenticated GET/POST/… — renews the access token once on 401 and retries. */
export async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  let response: Response;
  const team = teamHeader(path);
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        // An organization admin's chosen branch narrows every request; a call may name another one.
        ...branchHeader(),
        ...team,
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Нет связи с сервером. Проверьте интернет.');
  }

  if (response.status === 401 && !retried) {
    const user = await restoreSession();
    if (user === null) {
      sessionLost?.();
      throw new ApiError(401, 'UNAUTHORIZED', 'Сессия закончилась. Войдите снова.');
    }
    return apiFetch<T>(path, init, true);
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'SCOPE_OVERRIDE_FORBIDDEN' && 'X-MTF-Team-Id' in team) teamLost?.();
    throw error;
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

/** A change. `branchId` is needed by an organization admin acting on something in one branch. */
export function apiSend<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, branchId?: string | null): Promise<T> {
  return apiFetch<T>(path, {
    method,
    headers: branchHeader(branchId),
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Every page of a list, up to a sane limit for a phone. */
export async function apiGetAll<T>(path: string, maxPages = 5): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await apiFetch<Paged<T>>(`${path}${separator}page=${page}&pageSize=100`);
    items.push(...result.items);
    if (items.length >= result.totalCount || result.items.length === 0) break;
  }
  return items;
}
