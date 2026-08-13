import { Archive, ArchiveRestore, ListChecks, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { Drawer } from '../../../shared/overlays';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import type { LeadTopicAssignmentRecord, LeadTopicRecord } from '../../../mocks/ui-preview/leadTopics.preview';
import { TOPIC_ASSIGNMENT_TYPE_LABEL } from '../../../mocks/ui-preview/leadTopics.preview';
import { formatCategoryDate } from '../scope/leadDateFormat';
import { useLeadScope } from '../scope/useLeadScope';
import { useTopicAssignmentsOf } from '../scope/useScopedLeadSchedule';
import { createTopicAssignmentPreview, setTopicAssignmentActivePreview, updateTopicAssignmentPreview } from './leadSchedulePreviewStore';
import { TopicAssignmentFormModal } from './TopicAssignmentFormModal';
import type { TopicAssignmentFormValues } from './topicForm.schema';

export interface TopicDetailsDrawerProps {
  topic: LeadTopicRecord | undefined;
  topicId: string | null;
  onClose: () => void;
  onEditTopic: (topic: LeadTopicRecord) => void;
}

export function TopicDetailsDrawer({ topic, topicId, onClose, onEditTopic }: TopicDetailsDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const templates = useTopicAssignmentsOf(topicId);
  const [tpaModal, setTpaModal] = useState<{ mode: 'create' } | { mode: 'edit'; item: LeadTopicAssignmentRecord } | null>(null);

  const open = topicId !== null;

  function handleTpaSubmit(values: TopicAssignmentFormValues): void {
    if (topic === undefined) return;
    const normalized = { ...values, description: values.description ?? '' };
    if (tpaModal?.mode === 'edit') {
      updateTopicAssignmentPreview(tpaModal.item.id, normalized);
    } else {
      createTopicAssignmentPreview(scope.categoryId, topic.id, normalized);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={topic?.title ?? 'Тема'}
        description={topic !== undefined ? `День ${String(topic.dayNumber)} · ${formatCategoryDate(topic.plannedDate, scope.timeZoneId)}` : undefined}
        size="lg"
        headerActions={
          topic !== undefined ? (
            <Button variant="secondary" size="sm" leadingIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { onEditTopic(topic); }}>
              Изменить
            </Button>
          ) : undefined
        }
      >
        {topicId === null ? null : topic === undefined ? (
          <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} title="Тема недоступна" description="Она не найдена в вашем направлении." />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Badge tone={topic.isActive ? 'success' : 'neutral'}>{topic.isActive ? 'В расписании' : 'Архивная'}</Badge>
            </div>
            {topic.description.length > 0 ? <p className="text-[13.5px] leading-[20px] text-ink-secondary">{topic.description}</p> : null}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13.5px] font-semibold text-ink">Шаблоны заданий ({templates.length})</h3>
                <Button variant="secondary" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { setTpaModal({ mode: 'create' }); }}>
                  Добавить
                </Button>
              </div>

              {templates.length === 0 ? (
                <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} title="Пока нет шаблонов" description="Добавьте презентацию, аудиторное или домашнее задание для этой темы." />
              ) : (
                <ul className="space-y-2">
                  {templates.map((item) => (
                    <li key={item.id} className={`rounded-control border p-3.5 ${item.isActive ? 'border-line' : 'border-divider opacity-60'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone="neutral">{TOPIC_ASSIGNMENT_TYPE_LABEL[item.type]}</Badge>
                            {item.isRequired ? <span className="text-[11px] font-medium text-ink-muted">обязательное</span> : null}
                          </div>
                          <p className="mt-1.5 text-[13.5px] font-medium text-ink">{item.title}</p>
                          {item.description.length > 0 ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{item.description}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setTpaModal({ mode: 'edit', item }); }}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setTopicAssignmentActivePreview(item.id, !item.isActive); }}
                            title={item.isActive ? 'Архивировать' : 'Восстановить'}
                          >
                            {item.isActive ? <Archive className="h-3.5 w-3.5" aria-hidden="true" /> : <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <TopicAssignmentFormModal
        open={tpaModal !== null}
        existing={tpaModal?.mode === 'edit' ? tpaModal.item : undefined}
        onOpenChange={(next) => { if (!next) setTpaModal(null); }}
        onSubmit={handleTpaSubmit}
      />
    </>
  );
}
