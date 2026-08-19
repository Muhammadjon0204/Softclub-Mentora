import { CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { MentorTopicDetailsDrawer } from '../../features/mentor-schedule/MentorTopicDetailsDrawer';
import { useLeadTopicAssignmentsPreview } from '../../features/lead/schedule/leadSchedulePreviewStore';
import { formatCategoryDate } from '../../features/mentor/scope/mentorDateFormat';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';
import { useResolvedMentorTopic, useScopedMentorTopics } from '../../features/mentor/scope/useScopedMentorTopics';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';

function pluralizeTasks(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'заданий';
  if (mod10 === 1) return 'задание';
  if (mod10 >= 2 && mod10 <= 4) return 'задания';
  return 'заданий';
}

/**
 * `/mentor/schedule` (ТЗ 2.2, раздел 24.5) — расписание категории в режиме
 * только чтения: тот же Topic/TopicAssignment стор, что видит Lead
 * (`useLeadTopicAssignmentsPreview`, отфильтрован по своей категории через
 * `useScopedMentorTopics`), но без единой кнопки создания/редактирования.
 */
export function SchedulePage(): JSX.Element {
  const scope = useMentorScope();
  const topics = useScopedMentorTopics();
  const topicAssignments = useLeadTopicAssignmentsPreview();
  const [searchParams, setSearchParams] = useSearchParams();
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const assignmentCountByTopic = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tpa of topicAssignments) counts.set(tpa.topicId, (counts.get(tpa.topicId) ?? 0) + 1);
    return counts;
  }, [topicAssignments]);

  const topicId = searchParams.get('topicId');
  const selected = useResolvedMentorTopic(topicId);

  useEffect(() => {
    if (topicId !== null && selected === undefined) {
      const next = new URLSearchParams(searchParams);
      next.delete('topicId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, selected]);

  function openTopic(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('topicId', id);
    setSearchParams(next);
  }

  function closeTopic(): void {
    const idToFocus = topicId;
    const next = new URLSearchParams(searchParams);
    next.delete('topicId');
    setSearchParams(next);
    window.requestAnimationFrame(() => { if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus(); });
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Расписание" subtitle={`${scope.categoryName} · ${scope.branchDisplayName}`} />

      <Card padded={false} className="min-w-0">
        {topics.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} title="В категории пока нет тем" description="Темы расписания появятся здесь, когда руководитель их добавит." />
        ) : (
          <PreviewTable>
            <PreviewTableHead>
              <PreviewTh className="w-[86px]">День</PreviewTh>
              <PreviewTh className="min-w-[260px]">Тема</PreviewTh>
              <PreviewTh className="w-[130px]">Статус</PreviewTh>
            </PreviewTableHead>
            <tbody>
              {topics.map((topic) => {
                const taskCount = assignmentCountByTopic.get(topic.id) ?? 0;
                return (
                  <tr
                    key={topic.id}
                    ref={(node) => { if (node) rowRefs.current.set(topic.id, node); else rowRefs.current.delete(topic.id); }}
                    tabIndex={0}
                    onClick={() => { openTopic(topic.id); }}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTopic(topic.id); } }}
                    className={`cursor-pointer border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${topic.id === topicId ? 'bg-brand-soft' : 'hover:bg-surface-hover'} ${!topic.isActive ? 'opacity-70' : ''}`}
                  >
                    <PreviewTd className="py-3.5 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        <span className="flex h-7 w-7 items-center justify-center rounded-control-sm bg-brand-soft text-[12px] font-semibold tabular-nums text-brand">
                          {topic.dayNumber}
                        </span>
                        <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-muted">
                          {formatCategoryDate(topic.plannedDate, scope.timeZoneId)}
                        </span>
                      </div>
                    </PreviewTd>
                    <PreviewTd className="py-3.5 align-middle">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-semibold leading-5 text-ink" title={topic.title}>{topic.title}</p>
                        {topic.description.length > 0 ? (
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-muted" title={topic.description}>{topic.description}</p>
                        ) : null}
                        {taskCount > 0 ? (
                          <p className="mt-1 text-[11.5px] text-ink-disabled">{taskCount} {pluralizeTasks(taskCount)} по теме</p>
                        ) : null}
                      </div>
                    </PreviewTd>
                    <PreviewTd className="py-3.5 align-middle">
                      <Badge tone={topic.isActive ? 'success' : 'neutral'}>{topic.isActive ? 'В расписании' : 'Архивная'}</Badge>
                    </PreviewTd>
                  </tr>
                );
              })}
            </tbody>
          </PreviewTable>
        )}
      </Card>

      <MentorTopicDetailsDrawer topic={selected} topicId={topicId} onClose={closeTopic} />
    </div>
  );
}
