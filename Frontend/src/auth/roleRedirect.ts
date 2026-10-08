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

/**
 * Куда вести после входа: на страницу, с которой человека отправили на /login (например, ссылка из
 * Telegram на конкретное задание), — но только внутрь раздела его собственной роли и только
 * относительным путём. Иначе — на дашборд роли. Роль по-прежнему берётся из ответа API, а адрес из
 * state лишь выбирает страницу внутри уже разрешённого раздела.
 */
export function postLoginPath(role: UserRole, requested: unknown): string {
  const dashboard = dashboardPathForRole(role);
  const section = dashboard.slice(0, dashboard.indexOf('/', 1) + 1); // '/lead/'

  if (typeof requested !== 'string') return dashboard;
  // `//host` и `/\host` браузер трактует как внешний адрес — открытый редирект.
  if (!requested.startsWith(section) || requested.startsWith('//') || requested.includes('\\')) return dashboard;

  return requested;
}

/** `/profile` живёт внутри каждого ролевого layout'а (`FE-014`) — общая страница, свой путь на роль. */
export const ROLE_PROFILE_PATH: Record<UserRole, string> = {
  Admin: '/admin/profile',
  Lead: '/lead/profile',
  Mentor: '/mentor/profile',
};

export function profilePathForRole(role: UserRole): string {
  return ROLE_PROFILE_PATH[role];
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
