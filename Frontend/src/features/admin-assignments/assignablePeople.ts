import type { UserDto } from '../../api/admin/users';
import type { SelectOption } from '../../shared/select';

export const EXECUTOR_ROLE_LABEL: Record<string, string> = {
  Lead: 'Тимлид',
  Mentor: 'Ментор',
  Member: 'Участник',
};

/** Человек в конкретной команде: тому, кто в двух командах, задание выдают в одной из них. */
export interface AssigneeSeat {
  /** Уникально в списке выбора: один человек встречается по разу на каждую свою команду. */
  key: string;
  user: UserDto;
  categoryId: string;
  /** Роль в этой команде: `Lead` | `Mentor` | `Member`. */
  role: string;
}

function teamsOf(user: UserDto): { categoryId: string; role: string }[] {
  if (user.teams !== undefined) return user.teams;
  const executes = user.role === 'Lead' || user.role === 'Mentor';
  return executes && user.categoryId !== null ? [{ categoryId: user.categoryId, role: user.role }] : [];
}

/**
 * Кому можно выдать работу: активные участники команд, кроме самого выдающего — проверить свою работу
 * было бы некому. Тимлиды идут первыми, их меньше и искать их труднее.
 */
export function assignableSeats(users: UserDto[], selfId: string | null): AssigneeSeat[] {
  return users
    .filter((user) => user.isActive && user.id !== selfId)
    .flatMap((user) =>
      teamsOf(user).map((team) => ({ key: `${user.id}:${team.categoryId}`, user, categoryId: team.categoryId, role: team.role })),
    )
    .sort((a, b) =>
      (a.role === 'Lead') === (b.role === 'Lead')
        ? a.user.fullName.localeCompare(b.user.fullName, 'ru')
        : a.role === 'Lead' ? -1 : 1,
    );
}

export function seatOption(seat: AssigneeSeat, value: string, categoryName: string | undefined): SelectOption {
  const role = EXECUTOR_ROLE_LABEL[seat.role] ?? seat.role;
  return { value, label: seat.user.fullName, description: [role, categoryName, seat.user.branch?.name].filter(Boolean).join(' · ') };
}
