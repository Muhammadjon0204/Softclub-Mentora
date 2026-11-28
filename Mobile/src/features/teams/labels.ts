/** What a person can be in a team. A participant works in it without teaching. */
export const TEAM_ROLE_LABEL: Record<string, string> = {
  Lead: 'Тимлид',
  Mentor: 'Ментор',
  Member: 'Участник',
};

export const TEAM_ROLE_HINT: Record<string, string> = {
  Lead: 'Выдаёт и проверяет задания команды',
  Mentor: 'Преподаёт: получает задания и сдаёт их',
  Member: 'Работает в команде, но не преподаёт',
};

export const teamRoleLabel = (role: string): string => TEAM_ROLE_LABEL[role] ?? role;

/** The teams of a person as the server lists them, or the single one of an older answer. */
export function teamsOf(person: {
  teams?: { categoryId: string; role: string }[] | null;
  role: string;
  categoryId?: string | null;
}): { categoryId: string; role: string }[] {
  if (person.teams) return person.teams;
  return person.categoryId && person.role !== 'Admin' ? [{ categoryId: person.categoryId, role: person.role }] : [];
}
