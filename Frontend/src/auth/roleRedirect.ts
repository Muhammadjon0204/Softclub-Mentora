import type { UserRole } from '../api/auth';

/**
 * Роль берётся ТОЛЬКО из ответа API. Ни URL, ни форма, ни localStorage
 * не могут повлиять на то, куда попадёт пользователь.
 */
export const ROLE_DASHBOARD_PATH: Record<UserRole, string> = {
  Admin: '/admin/dashboard',
  Lead: '/lead/dashboard',
  Mentor: '/mentor/dashboard',
};

export function dashboardPathForRole(role: UserRole): string {
  return ROLE_DASHBOARD_PATH[role];
}

/** Публичные auth-страницы: RequireAuth к ним не применяется. */
export const PUBLIC_AUTH_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/set-password',
] as const;

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
