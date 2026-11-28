/**
 * Один человек в нескольких командах. Аккаунт открывается «как есть» (основная команда или панель
 * администратора), а в любую другую команду можно переключиться — и тогда весь интерфейс строится по
 * роли в ней: тимлид там или исполнитель.
 */
import type { AuthUser, UserRole } from '../api/auth';

export type TeamSummary = NonNullable<AuthUser['teams']>[number];

/** Команды, в которые переключаются: все, кроме той, где аккаунт открывается сам. */
export function switchableTeams(account: AuthUser): TeamSummary[] {
  return (account.teams ?? []).filter((team) => !team.isMain);
}

/** Участник работает с теми же страницами, что и ментор: получает задания и сдаёт их. */
export function roleInTeam(team: Pick<TeamSummary, 'role'>): UserRole {
  return team.role === 'Lead' ? 'Lead' : 'Mentor';
}

/** Профиль, каким его видит интерфейс, пока человек работает в выбранной команде. */
export function userInTeam(account: AuthUser, teamId: string | null): AuthUser {
  const team = switchableTeams(account).find((candidate) => candidate.categoryId === teamId);
  if (team === undefined) return account;

  return {
    ...account,
    role: roleInTeam(team),
    adminScope: null,
    category: { id: team.categoryId, name: team.name, timeZoneId: team.timeZoneId },
    permissions: team.permissions,
  };
}

const SECTION_ROLE: Record<string, UserRole> = { admin: 'Admin', lead: 'Lead', mentor: 'Mentor' };

/**
 * В какой команде открывать адрес — при загрузке страницы и после входа.
 *
 * Ссылка из уведомления называет команду параметром `team`. Без него держимся последнего выбора,
 * если он подходит разделу адреса; иначе выбираем то, в чём этот раздел вообще открывается.
 */
export function teamForPath(account: AuthUser, path: string, remembered: string | null): string | null {
  const url = new URL(path, 'http://app.invalid');
  const teams = switchableTeams(account);
  const known = (id: string | null): string | null =>
    id !== null && teams.some((team) => team.categoryId === id) ? id : null;

  const requested = url.searchParams.get('team');
  if (requested !== null && account.teams?.some((team) => team.categoryId === requested)) {
    return known(requested);
  }

  const kept = known(remembered);
  const section = SECTION_ROLE[url.pathname.split('/')[1] ?? ''];
  if (section === undefined || userInTeam(account, kept).role === section) return kept;
  if (account.role === section) return null;

  return teams.find((team) => roleInTeam(team) === section)?.categoryId ?? kept;
}
