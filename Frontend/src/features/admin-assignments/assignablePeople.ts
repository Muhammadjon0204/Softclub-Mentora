import type { UserDto } from '../../api/admin/users';
import type { SelectOption } from '../../shared/select';

export const EXECUTOR_ROLE_LABEL: Record<string, string> = {
  Lead: 'Тимлид',
  Mentor: 'Ментор',
};

/** Кому можно выдать работу: активные лиды и менторы. Лиды идут первыми, их меньше и искать их труднее. */
export function assignablePeople(users: UserDto[]): UserDto[] {
  return users
    .filter((user) => user.isActive && (user.role === 'Lead' || user.role === 'Mentor') && user.categoryId !== null)
    .sort((a, b) => (a.role === b.role ? a.fullName.localeCompare(b.fullName, 'ru') : a.role === 'Lead' ? -1 : 1));
}

export function personOption(user: UserDto, categoryName: string | undefined): SelectOption {
  const role = EXECUTOR_ROLE_LABEL[user.role] ?? user.role;
  return { value: user.id, label: user.fullName, description: [role, categoryName, user.branch?.name].filter(Boolean).join(' · ') };
}
