import { ListChecks } from 'lucide-react';

import { Drawer } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { LeadTopicRecord } from '../../mocks/ui-preview/leadTopics.preview';
import { TOPIC_ASSIGNMENT_TYPE_LABEL } from '../../mocks/ui-preview/leadTopics.preview';
import { formatCategoryDate } from '../mentor/scope/mentorDateFormat';
import { useMentorScope } from '../mentor/scope/useMentorScope';
import { useTopicAssignmentsOfMentor } from '../mentor/scope/useScopedMentorTopics';

export interface MentorTopicDetailsDrawerProps {
  topic: LeadTopicRecord | undefined;
  topicId: string | null;
  onClose: () => void;
}

/**
 * Read-only просмотр темы расписания — тот же контент, что видит Lead в
 * `TopicDetailsDrawer`, но без единой кнопки редактирования: CRUD
 * Topic/TopicAssignment Mentor недоступен ни в каком виде (ТЗ 8.4,
 * Приложение A — «Просмотр расписания категории: Mentor — Да (своя,
 * чтение)»).
 */
export function MentorTopicDetailsDrawer({ topic, topicId, onClose }: MentorTopicDetailsDrawerProps): JSX.Element {
  const scope = useMentorScope();
  const templates = useTopicAssignmentsOfMentor(topicId);
  const open = topicId !== null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={topic?.title ?? 'Тема'}
      description={topic !== undefined ? `День ${String(topic.dayNumber)} · ${formatCategoryDate(topic.plannedDate, scope.timeZoneId)}` : undefined}
      size="lg"
    >
      {topicId === null ? null : topic === undefined ? (
        <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} title="Тема недоступна" description="Она не найдена в вашей категории." />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge tone={topic.isActive ? 'success' : 'neutral'}>{topic.isActive ? 'В расписании' : 'Архивная'}</Badge>
          </div>
          {topic.description.length > 0 ? <p className="text-[13.5px] leading-[20px] text-ink-secondary">{topic.description}</p> : null}

          <div>
            <h3 className="mb-3 text-[13.5px] font-semibold text-ink">Задания темы ({templates.length})</h3>
            {templates.length === 0 ? (
              <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} title="Пока нет заданий" description="Руководитель ещё не добавил задания к этой теме." />
            ) : (
              <ul className="space-y-2">
                {templates.map((item) => (
                  <li key={item.id} className={`rounded-control border p-3.5 ${item.isActive ? 'border-line' : 'border-divider opacity-60'}`}>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{TOPIC_ASSIGNMENT_TYPE_LABEL[item.type]}</Badge>
                      {item.isRequired ? <span className="text-[11px] font-medium text-ink-muted">обязательное</span> : null}
                    </div>
                    <p className="mt-1.5 text-[13.5px] font-medium text-ink">{item.title}</p>
                    {item.description.length > 0 ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{item.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
