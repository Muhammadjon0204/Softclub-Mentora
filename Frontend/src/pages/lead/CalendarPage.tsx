import { useCallback, useMemo } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { DeadlineCalendar } from '../../features/deadline-calendar/DeadlineCalendar';
import { toneOf, type CalendarEvent } from '../../features/deadline-calendar/deadlineEvents';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { useScopedLeadMentors } from '../../features/lead/scope/useScopedLeadMentors';

/** `/lead/calendar` — дедлайны всех менторов команды (категории тимлида). */
export function CalendarPage(): JSX.Element {
  const scope = useLeadScope();
  const mentors = useScopedLeadMentors();
  const nameById = useMemo(() => new Map(mentors.map((mentor) => [mentor.id, mentor.fullName])), [mentors]);

  const toEvent = useCallback(
    (dto: AssignmentDto): CalendarEvent => {
      const tone = toneOf(dto.status);
      return {
        id: dto.id,
        title: dto.title,
        person: nameById.get(dto.assignedToId) ?? 'Ментор',
        context: null,
        dueAtMs: Date.parse(dto.currentDueAt),
        tone,
        href: `/lead/assignments?assignmentId=${dto.id}`,
      };
    },
    [nameById],
  );

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Календарь" subtitle={`${scope.categoryName} · дедлайны менторов команды`} />
      <DeadlineCalendar
        scopeKey={['lead', scope.organizationId, scope.categoryId]}
        timeZoneId={scope.timeZoneId}
        toEvent={toEvent}
        emptyUpcomingHint="У команды впереди нет дедлайнов. Назначьте задание — оно появится здесь."
      />
    </div>
  );
}
