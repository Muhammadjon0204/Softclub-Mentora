import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useUser } from '@/lib/session';

import { listAssignments, listPeople, type Assignment } from './api';

/** One list per account, shared by the home screen, the review queue and the tab badge. */
export function useAssignments() {
  const user = useUser();
  return useQuery({ queryKey: ['assignments', user.id], queryFn: () => listAssignments(user) });
}

/** `id → full name` for a lead or an administrator; empty for a mentor. */
export function usePeopleNames(): (id: string | null | undefined) => string | null {
  const user = useUser();
  const query = useQuery({
    queryKey: ['people', user.id],
    queryFn: listPeople,
    enabled: user.role !== 'Mentor',
    staleTime: 5 * 60_000,
  });
  const names = useMemo(() => new Map((query.data ?? []).map((p) => [p.id, p.fullName])), [query.data]);
  return (id) => (id ? (id === user.id ? user.fullName : (names.get(id) ?? null)) : null);
}

/** Work waiting for this person's decision: only what they handed out themselves. */
export function awaitingMyReview(items: Assignment[]): Assignment[] {
  return items
    .filter((a) => a.canManage === true && (a.status === 'Submitted' || a.status === 'InReview'))
    .sort((x, y) => Date.parse(x.firstSubmittedAt ?? x.currentDueAt) - Date.parse(y.firstSubmittedAt ?? y.currentDueAt));
}

export function useCan(): (permission: string) => boolean {
  const user = useUser();
  return (permission) => !user.permissions || user.permissions.includes(permission);
}
