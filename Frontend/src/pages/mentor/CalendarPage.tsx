import { useCallback } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { DeadlineCalendar } from '../../features/deadline-calendar/DeadlineCalendar';
import { toneOf, type CalendarEvent } from '../../features/deadline-calendar/deadlineEvents';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';

/** `/mentor/calendar` — дедлайны собственных заданий ментора. */
export function CalendarPage(): JSX.Element {
  const scope = useMentorScope();

  const toEvent = useCallback((dto: AssignmentDto): CalendarEvent => {
    const tone = toneOf(dto.status);
    return {
      id: dto.id,
      title: dto.title,
      person: null,
      context: null,
      dueAtMs: Date.parse(dto.currentDueAt),
      tone,
      href: `/mentor/tasks?assignmentId=${dto.id}`,
    };
  }, []);

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Календарь" subtitle={`${scope.categoryName} · дедлайны ваших заданий`} />
      <DeadlineCalendar
        scopeKey={['mentor', scope.organizationId, scope.mentorId]}
        timeZoneId={scope.timeZoneId}
        toEvent={toEvent}
        emptyUpcomingHint="Впереди дедлайнов нет. Новые задания появятся здесь автоматически."
      />
    </div>
  );
}
