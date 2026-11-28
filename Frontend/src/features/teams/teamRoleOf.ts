interface TeamPerson {
  teams?: { categoryId: string; role: string }[];
  role: string;
  categoryId: string | null;
}

/**
 * Кем человек является в этой команде: `Lead` | `Mentor` | `Member`, или `null`, если его в ней нет.
 *
 * Сервер присылает `teams`; ответ без этого списка (старый сервер, моки) означает одну команду —
 * ту, что записана в аккаунте.
 */
export function teamRoleOf(person: TeamPerson, categoryId: string): string | null {
  if (person.teams !== undefined) {
    return person.teams.find((team) => team.categoryId === categoryId)?.role ?? null;
  }
  return person.categoryId === categoryId ? person.role : null;
}
