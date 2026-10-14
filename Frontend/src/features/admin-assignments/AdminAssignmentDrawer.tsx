import { useQuery } from '@tanstack/react-query';
import { AlignLeft, Building2, CalendarClock, CalendarPlus, CheckCircle2, Flag, FolderKanban, History, Send, Tag, UserRound, XCircle } from 'lucide-react';

import { getAssignmentHistory } from '../../api/lead/assignments';
import type { AssignmentDto } from '../../api/lead/assignments';
import { Drawer } from '../../shared/overlays';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { MetaTiles, Notice, SectionLabel, TextPanel } from '../../shared/ui/DetailBlocks';
import type { MetaItem } from '../../shared/ui/DetailBlocks';
import { Skeleton } from '../../shared/ui/Skeleton';
import { ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_TONE, deadlineHint, formatDateTimeRu, taskEventTitle } from './adminAssignmentView';

/** Сервер не пишет в JSON поля со значением null — они приходят как undefined. */
function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

interface AdminAssignmentDrawerProps {
  assignment: AssignmentDto | null;
  mentorName: string;
  categoryName: string | null;
  nameOf: (userId: string) => string | null;
  onClose: () => void;
}

/** Карточка задания для администратора: только чтение — описание, факты, история событий. */
export function AdminAssignmentDrawer({ assignment, mentorName, categoryName, nameOf, onClose }: AdminAssignmentDrawerProps): JSX.Element {
  const status = assignment?.status ?? 'Draft';
  const tone = ASSIGNMENT_STATUS_TONE[status] ?? 'neutral';

  return (
    <Drawer
      open={assignment !== null}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={assignment?.title ?? 'Задание'}
      size="lg"
      headerActions={
        assignment !== null ? (
          <Badge tone={tone}>
            <StatusDot tone={tone} />
            {ASSIGNMENT_STATUS_LABEL[status] ?? status}
          </Badge>
        ) : null
      }
    >
      {assignment !== null ? <DrawerContent assignment={assignment} mentorName={mentorName} categoryName={categoryName} nameOf={nameOf} /> : null}
    </Drawer>
  );
}

function DrawerContent({ assignment, mentorName, categoryName, nameOf }: Omit<AdminAssignmentDrawerProps, 'onClose' | 'assignment'> & { assignment: AssignmentDto }): JSX.Element {
  const deadlineMoved = assignment.currentDueAt !== assignment.initialDueAt;
  const hint = deadlineHint(assignment.status, new Date(assignment.currentDueAt).getTime(), Date.now());

  const items: MetaItem[] = [
    { icon: UserRound, label: 'Ментор', value: mentorName, tone: 'brand' },
    { icon: FolderKanban, label: 'Направление', value: categoryName ?? '—' },
    {
      icon: CalendarClock,
      label: deadlineMoved ? 'Текущий дедлайн' : 'Дедлайн',
      value: (
        <>
          {formatDateTimeRu(assignment.currentDueAt)}
          {hint !== null ? <span className={`block text-[11.5px] font-normal ${hint.tone === 'danger' ? 'text-danger' : hint.tone === 'warning' ? 'text-warning' : 'text-ink-muted'}`}>{hint.text}</span> : null}
        </>
      ),
      tone: assignment.status === 'Overdue' ? 'danger' : 'warning',
    },
    ...(deadlineMoved ? [{ icon: Flag, label: 'Начальный дедлайн', value: formatDateTimeRu(assignment.initialDueAt) }] : []),
    { icon: Tag, label: 'Источник', value: assignment.source === 'Auto' ? 'Из расписания' : 'Индивидуальное' },
    ...(present(assignment.assignedAt) ? [{ icon: CalendarPlus, label: 'Назначено', value: formatDateTimeRu(assignment.assignedAt) }] : []),
    ...(present(assignment.firstSubmittedAt) ? [{ icon: Send, label: 'Первая сдача', value: formatDateTimeRu(assignment.firstSubmittedAt), tone: 'info' as const }] : []),
    ...(present(assignment.approvedAt) ? [{ icon: CheckCircle2, label: 'Одобрено', value: formatDateTimeRu(assignment.approvedAt), tone: 'success' as const }] : []),
    ...(present(assignment.branch) ? [{ icon: Building2, label: 'Филиал', value: assignment.branch.name }] : []),
  ];

  return (
    <div className="space-y-5">
      {assignment.status === 'Cancelled' ? (
        <Notice tone="danger" icon={XCircle} title="Задание отменено">{assignment.cancelReason ?? 'Причина не указана.'}</Notice>
      ) : null}
      <TextPanel icon={AlignLeft} title="Описание задания" text={assignment.description ?? ''} emptyText="Описание не добавлено" />
      <MetaTiles items={items} />
      <AssignmentTimeline assignmentId={assignment.id} nameOf={nameOf} />
    </div>
  );
}

function AssignmentTimeline({ assignmentId, nameOf }: { assignmentId: string; nameOf: (userId: string) => string | null }): JSX.Element {
  const query = useQuery({ queryKey: ['admin-assignments', 'history', assignmentId], queryFn: () => getAssignmentHistory(assignmentId) });
  const events = [...(query.data ?? [])].sort((a, b) => b.sequenceNumber - a.sequenceNumber);

  return (
    <section>
      <SectionLabel>История</SectionLabel>
      {query.isPending ? (
        <div className="space-y-2.5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : query.error !== null ? (
        <p className="text-[13px] text-ink-muted">Не удалось загрузить историю.</p>
      ) : events.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Событий пока нет.</p>
      ) : (
        <ol className="relative space-y-0">
          {events.map((event, index) => {
            const actor = event.actorLabel ?? (present(event.actorId) ? nameOf(event.actorId) : null) ?? 'Система';
            return (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < events.length - 1 ? <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-line" /> : null}
                <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <History className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[13px] font-medium text-ink">{taskEventTitle(event.eventType)}</p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {actor} · {formatDateTimeRu(event.occurredAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
