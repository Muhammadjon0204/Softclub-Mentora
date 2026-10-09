import { useCallback, useMemo } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import { useAuth } from '../../auth/useAuth';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { DEFAULT_TIMEZONE } from '../../features/admin-branches/branchPresentation';
import { useUsersQuery } from '../../features/admin-users/useUsersQuery';
import { branchScopedKey } from '../../features/branch-context/queryKeys';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { DeadlineCalendar } from '../../features/deadline-calendar/DeadlineCalendar';
import { toneOf, type CalendarEvent } from '../../features/deadline-calendar/deadlineEvents';

/**
 * `/admin/calendar` — дедлайны всех команд. Branch Admin видит свой филиал, Organization Admin —
 * выбранный филиал или все сразу (тот же branch-context, что у остальных разделов): сужение делает
 * сервер по `X-MTF-Branch-Id`, страница только подписывает события.
 */
export function CalendarPage(): JSX.Element {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const { users } = useUsersQuery();

  const userById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const selectedBranch = branchContext.availableBranches.find((branch) => branch.id === branchContext.selectedBranchId);
  // У списка филиалов нет часового пояса; все филиалы организации живут по её поясу.
  const timeZoneId = DEFAULT_TIMEZONE;
  const showBranch = branchContext.isAllBranches;

  const toEvent = useCallback(
    (dto: AssignmentDto): CalendarEvent => {
      const tone = toneOf(dto.status);
      const mentor = userById.get(dto.assignedToId);
      const context = [mentor?.categoryName ?? null, showBranch ? (dto.branch?.name ?? mentor?.branchName ?? null) : null]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · ');
      return {
        id: dto.id,
        title: dto.title,
        person: mentor?.fullName ?? 'Ментор',
        context: context === '' ? null : context,
        dueAtMs: Date.parse(dto.currentDueAt),
        tone,
        href: '/admin/assignments',
      };
    },
    [userById, showBranch],
  );

  const subtitle = branchContext.isAllBranches
    ? 'Дедлайны всех филиалов и команд организации'
    : `Дедлайны всех команд филиала${selectedBranch !== undefined ? ` «${selectedBranch.name}»` : branchContext.fixedBranch !== null ? ` «${branchContext.fixedBranch.name}»` : ''}`;

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Календарь" subtitle={subtitle} />
      <DeadlineCalendar
        scopeKey={branchScopedKey('admin-calendar', user?.organization.id ?? 'anonymous', branchContext.selectedBranchId)}
        timeZoneId={timeZoneId}
        toEvent={toEvent}
        emptyUpcomingHint="Впереди дедлайнов нет ни у одной команды."
      />
    </div>
  );
}
