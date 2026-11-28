import { useQuery } from '@tanstack/react-query';

import { listCategories } from '@/api/categories';
import { listUsers, type User } from '@/api/users';
import { teamRoleLabel, teamsOf } from '@/features/teams/labels';
import { useUser } from '@/lib/session';
import type { Option } from '@/ui/sheet';

import { useT } from '@/lib/i18n';

/** A person in one team: somebody in two teams is given work in one of them. */
export interface Seat {
  /** Unique in a picker — a person appears once per team. */
  key: string;
  user: User;
  categoryId: string;
  role: string;
}

export const seatKey = (userId: string, categoryId: string): string => `${userId}:${categoryId}`;

/** Who may be given work, as on the site: active team members, never yourself. */
export function useAssignees(): { options: Option<string>[]; byKey: Map<string, Seat>; loading: boolean } {
  const me = useUser();
  const { t } = useT();
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const seats: Seat[] = (users.data ?? [])
    .filter((u) => u.isActive && u.id !== me.id)
    .flatMap((u) => teamsOf(u).map((team) => ({ key: seatKey(u.id, team.categoryId), user: u, categoryId: team.categoryId, role: team.role })))
    // A lead hands work to the mentors and participants of their own team.
    .filter((seat) => me.role !== 'Lead' || (seat.role !== 'Lead' && seat.categoryId === me.category?.id))
    .sort((a, b) =>
      (a.role === 'Lead') === (b.role === 'Lead') ? a.user.fullName.localeCompare(b.user.fullName, 'ru') : a.role === 'Lead' ? -1 : 1,
    );
  return {
    options: seats.map((seat) => ({
      value: seat.key,
      label: seat.user.fullName,
      hint: [t(teamRoleLabel(seat.role)), categoryName.get(seat.categoryId), seat.user.branch?.name].filter(Boolean).join(' · '),
    })),
    byKey: new Map(seats.map((seat) => [seat.key, seat])),
    loading: users.isPending,
  };
}
