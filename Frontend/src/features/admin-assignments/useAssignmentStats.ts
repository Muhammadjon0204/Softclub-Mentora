import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { listAssignments } from '../../api/lead/assignments';
import type { AssignmentDto } from '../../api/lead/assignments';
import { useAuth } from '../../auth/useAuth';
import { branchScopedKey } from '../branch-context/queryKeys';
import { useBranchContext } from '../branch-context/useBranchContext';
import { ACTIVE_STATUSES, AWAITING_REVIEW_STATUSES } from './adminAssignmentView';

/** Показатели одной группы заданий (направление, филиал). */
export interface AssignmentStats {
  total: number;
  active: number;
  inReview: number;
  overdue: number;
  approved: number;
  cancelled: number;
  /** Одобренные, сданные не позже дедлайна. */
  approvedOnTime: number;
  /** Среднее время от первой сдачи до одобрения, часы; `null` — одобренных ещё нет. */
  avgReviewHours: number | null;
  /** Доля одобренных среди заданий в работе (без черновиков и отменённых), %; `null` — заданий ещё нет. */
  completionPct: number | null;
  /** Доля сданных в срок среди одобренных, %; `null` — одобренных ещё нет. */
  onTimePct: number | null;
}

const NOT_WORKING = ['Draft', 'Suggested', 'Cancelled'];

/** Сервер не пишет null-поля в JSON — они приходят как undefined. */
function has(value: string | null | undefined): value is string {
  return value !== null && value !== undefined;
}

export function computeAssignmentStats(items: AssignmentDto[]): AssignmentStats {
  const working = items.filter((a) => !NOT_WORKING.includes(a.status));
  const approved = items.filter((a) => a.status === 'Approved');
  const approvedOnTime = approved.filter((a) => has(a.firstSubmittedAt) && new Date(a.firstSubmittedAt) <= new Date(a.currentDueAt)).length;
  const reviewDurations = approved
    .filter((a) => has(a.firstSubmittedAt) && has(a.approvedAt))
    .map((a) => (new Date(a.approvedAt as string).getTime() - new Date(a.firstSubmittedAt as string).getTime()) / 3_600_000);

  return {
    total: items.length,
    active: items.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    inReview: items.filter((a) => AWAITING_REVIEW_STATUSES.includes(a.status)).length,
    overdue: items.filter((a) => a.status === 'Overdue').length,
    approved: approved.length,
    cancelled: items.filter((a) => a.status === 'Cancelled').length,
    approvedOnTime,
    avgReviewHours: reviewDurations.length === 0 ? null : reviewDurations.reduce((sum, h) => sum + h, 0) / reviewDurations.length,
    completionPct: working.length === 0 ? null : Math.round((approved.length / working.length) * 100),
    onTimePct: approved.length === 0 ? null : Math.round((approvedOnTime / approved.length) * 100),
  };
}

/** «5 ч», «2 дн. 4 ч» — человекочитаемая длительность проверки. */
export function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${String(Math.max(1, Math.round(hours * 60)))} мин`;
  if (hours < 24) return `${String(Math.round(hours))} ч`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  return rest === 0 ? `${String(days)} дн.` : `${String(days)} дн. ${String(rest)} ч`;
}

/**
 * Все задания текущего филиала/организации (тот же ключ, что у страницы «Задания» — один запрос
 * на обе) и показатели по направлениям.
 */
export function useAssignmentStats() {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';

  const query = useQuery({
    queryKey: branchScopedKey('admin-assignments', organizationId, branchContext.selectedBranchId, 'list'),
    queryFn: () => listAssignments({ page: 1, pageSize: 100, sort: 'currentDueAt', order: 'desc' }),
    enabled: user !== null,
  });

  const byCategory = useMemo(() => {
    const groups = new Map<string, AssignmentDto[]>();
    for (const item of query.data?.items ?? []) {
      const list = groups.get(item.categoryId) ?? [];
      list.push(item);
      groups.set(item.categoryId, list);
    }
    return new Map([...groups].map(([id, items]) => [id, computeAssignmentStats(items)]));
  }, [query.data]);

  return { query, items: query.data?.items ?? [], byCategory };
}
