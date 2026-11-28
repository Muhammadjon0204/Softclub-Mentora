/** Кем человек может быть в команде. «Участник» работает в ней, но не преподаёт. */
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

export function teamRoleLabel(role: string): string {
  return TEAM_ROLE_LABEL[role] ?? role;
}
