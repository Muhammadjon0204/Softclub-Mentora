import { useMemo } from 'react';

import { useLeadAssignmentsPreview } from '../assignments/leadAssignmentPreviewStore';
import type { LeadAssignmentRecord } from '../../../mocks/ui-preview/leadAssignments.preview';
import { useLeadScope } from './useLeadScope';

/**
 * Единственная точка чтения Assignment для всех Lead-страниц. `useLeadAssignmentsPreview()`
 * сам по себе отдаёт store целиком, включая fixtures чужих категорий (нужны
 * для контроля изоляции, см. `leadAssignments.preview.ts`) — если бы каждая
 * страница фильтровала его по-своему, было бы легко забыть фильтр на одной
 * из них (ровно тот класс ошибки, что уже находили при Branch Admin, раздел 5
 * задачи Phase 3). Поэтому фильтрация происходит один раз здесь.
 */
export function useScopedLeadAssignments(): LeadAssignmentRecord[] {
  const scope = useLeadScope();
  const all = useLeadAssignmentsPreview();
  return useMemo(() => all.filter((a) => a.categoryId === scope.categoryId), [all, scope.categoryId]);
}

/** Резолвит id только внутри собственного scope — id из чужой категории или несуществующий даёт `undefined` одинаково (anti-enumeration). */
export function useResolvedLeadAssignment(assignmentId: string | null): LeadAssignmentRecord | undefined {
  const scoped = useScopedLeadAssignments();
  if (assignmentId === null) return undefined;
  return scoped.find((a) => a.id === assignmentId);
}
