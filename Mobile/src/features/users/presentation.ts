import type { User } from '@/api/users';
import type { Tone } from '@/features/assignments/status';

export function userStatus(user: User): { label: string; tone: Tone } {
  if (!user.isActive) return { label: 'Отключён', tone: 'neutral' };
  if (!user.hasPassword) return { label: 'Приглашён', tone: 'warning' };
  return { label: 'Активен', tone: 'success' };
}

export const USER_ROLE_LABEL: Record<User['role'], string> = { Admin: 'Администратор', Lead: 'Тимлид', Mentor: 'Ментор' };
