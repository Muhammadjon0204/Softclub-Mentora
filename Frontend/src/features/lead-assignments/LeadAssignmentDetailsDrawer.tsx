import { useEffect, useState } from 'react';
import { AlertTriangle, AlignLeft, CalendarClock, CalendarPlus, CheckCircle2, FileText, Flag, Layers, Tag, UserRound, XCircle } from 'lucide-react';

import { Drawer } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { MetaTiles, Notice, QuoteBlock, TextPanel } from '../../shared/ui/DetailBlocks';
import type { MetaItem } from '../../shared/ui/DetailBlocks';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import { SubmissionVersionCard } from '../assignment-details/SubmissionVersionCard';
import type { LeadAssignmentRecord, LeadSubmissionFile } from '../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { formatCategoryDateTime } from '../lead/scope/leadDateFormat';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { assignmentCapabilities, averageVersionsLabel, LEAD_STATUS_META, sourceLabel, taskEventLabel } from '../lead/assignments/leadAssignmentPresentation';

type Tab = 'overview' | 'submissions' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'submissions', label: 'Решения' },
  { id: 'history', label: 'История' },
];

export interface LeadAssignmentDetailsDrawerProps {
  assignment: LeadAssignmentRecord | undefined;
  assignmentId: string | null;
  onClose: () => void;
  onEdit: (a: LeadAssignmentRecord) => void;
  onPublish: (a: LeadAssignmentRecord) => void;
  onAcceptSuggestion: (a: LeadAssignmentRecord) => void;
  onReject: (a: LeadAssignmentRecord) => void;
  onCancel: (a: LeadAssignmentRecord) => void;
  onReassign: (a: LeadAssignmentRecord) => void;
  onStartReview: (a: LeadAssignmentRecord) => void;
  onOpenReview: (a: LeadAssignmentRecord) => void;
  mentorNameOf: (mentorId: string) => string;
}

function OverviewTab({ assignment, mentorNameOf }: { assignment: LeadAssignmentRecord; mentorNameOf: (mentorId: string) => string }): JSX.Element {
  const scope = useLeadScope();
  const format = (ms: number): string => formatCategoryDateTime(ms, scope.timeZoneId);
  const deadlineMoved = assignment.currentDueAt !== assignment.initialDueAt;
  const latestReview = assignment.submissions[assignment.submissions.length - 1]?.review ?? null;

  const items: MetaItem[] = [
    { icon: UserRound, label: 'Ментор', value: mentorNameOf(assignment.mentorId), tone: 'brand' },
    { icon: Tag, label: 'Источник', value: sourceLabel(assignment.source) },
    { icon: CalendarClock, label: deadlineMoved ? 'Текущий дедлайн' : 'Дедлайн', value: format(assignment.currentDueAt), tone: 'warning' },
    ...(deadlineMoved ? [{ icon: Flag, label: 'Начальный дедлайн', value: format(assignment.initialDueAt) }] : []),
    ...(assignment.assignedAt !== null ? [{ icon: CalendarPlus, label: 'Назначено', value: format(assignment.assignedAt) }] : []),
    ...(assignment.approvedAt !== null ? [{ icon: CheckCircle2, label: 'Принято', value: format(assignment.approvedAt), tone: 'success' as const }] : []),
    ...(assignment.overdueAt !== null ? [{ icon: AlertTriangle, label: 'Просрочено с', value: format(assignment.overdueAt), tone: 'danger' as const }] : []),
    { icon: Layers, label: 'Версий решения', value: averageVersionsLabel(assignment) },
  ];

  return (
    <div className="space-y-5">
      <TextPanel icon={AlignLeft} title="Описание задания" text={assignment.description} emptyText="Описание не добавлено" />
      <MetaTiles items={items} />
      {assignment.status === 'Cancelled' && assignment.cancelReason !== null ? (
        <Notice tone="danger" icon={XCircle} title="Задание отменено">{assignment.cancelReason}</Notice>
      ) : null}
      {assignment.status === 'NeedsRework' && latestReview !== null && latestReview.comment !== null ? (
        <QuoteBlock tone="warning" label={`На доработке · ${latestReview.reviewerName}`} text={latestReview.comment} meta={format(latestReview.createdAt)} />
      ) : null}
    </div>
  );
}

function SubmissionsTab({ assignment, onOpenFile }: { assignment: LeadAssignmentRecord; onOpenFile: (file: LeadSubmissionFile, submittedAt: number) => void }): JSX.Element {
  const scope = useLeadScope();

  if (assignment.submissions.length === 0) {
    return <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Решений пока нет" description="Ментор ещё не отправлял ни одной версии по этому заданию." />;
  }

  return (
    <div className="space-y-3">
      {[...assignment.submissions].reverse().map((submission, index) => (
        <SubmissionVersionCard
          key={submission.id}
          submission={submission}
          isCurrent={index === 0}
          commentLabel="Комментарий ментора"
          formatDate={(ms) => formatCategoryDateTime(ms, scope.timeZoneId)}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function HistoryTab({ assignment }: { assignment: LeadAssignmentRecord }): JSX.Element {
  const scope = useLeadScope();
  return (
    <ol className="space-y-4 border-l border-divider pl-4">
      {[...assignment.events].reverse().map((event) => (
        <li key={event.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
          <p className="text-[13px] font-medium text-ink">{taskEventLabel(event)}</p>
          {event.detail !== undefined ? <p className="text-[12.5px] text-ink-secondary">{event.detail}</p> : null}
          <p className="text-[11.5px] text-ink-muted">{event.actorName} · {formatCategoryDateTime(event.occurredAt, scope.timeZoneId)}</p>
        </li>
      ))}
    </ol>
  );
}

/** Detail-drawer задания Lead: обзор/решения/история + действия, доступные исключительно по текущему статусу (табл. 13.3 ТЗ). */
export function LeadAssignmentDetailsDrawer(props: LeadAssignmentDetailsDrawerProps): JSX.Element {
  const { assignment, assignmentId, onClose, mentorNameOf } = props;
  const [tab, setTab] = useState<Tab>('overview');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);

  useEffect(() => {
    if (assignmentId !== null) setTab('overview');
  }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? LEAD_STATUS_META[assignment.status] : null;
  const caps = assignment !== undefined ? assignmentCapabilities(assignment) : null;

  const scope = useLeadScope();

  function handleOpenFile(raw: LeadSubmissionFile, submittedAt: number): void {
    const file: SubmissionFile = { ...raw, uploadedLabel: formatCategoryDateTime(submittedAt, scope.timeZoneId) };
    if (file.extension === 'pdf') setPreviewFile(file);
    else setDetailsFile(file);
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={assignment?.title ?? 'Задание'}
        size="lg"
        headerActions={
          assignment !== undefined && statusMeta !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium" role="status" aria-label={`Статус: ${LEAD_ASSIGNMENT_STATUS_LABEL[assignment.status]}`}>
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
              <span className={statusMeta.text}>{LEAD_ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
            </span>
          ) : undefined
        }
        footer={
          assignment !== undefined && caps !== null ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {caps.canReject ? <Button variant="secondary" onClick={() => { props.onReject(assignment); }}>Отклонить</Button> : null}
              {caps.canCancel ? <Button variant="secondary" onClick={() => { props.onCancel(assignment); }}>Отменить</Button> : null}
              {caps.canReassign ? <Button variant="secondary" onClick={() => { props.onReassign(assignment); }}>Переназначить</Button> : null}
              {caps.canEdit ? <Button variant="secondary" onClick={() => { props.onEdit(assignment); }}>Редактировать</Button> : null}
              {caps.canStartReview ? <Button variant="primary" onClick={() => { props.onStartReview(assignment); }}>Начать проверку</Button> : null}
              {assignment.status === 'InReview' ? <Button variant="primary" onClick={() => { props.onOpenReview(assignment); }}>Перейти к проверке</Button> : null}
              {caps.canAcceptSuggestion ? <Button variant="primary" onClick={() => { props.onAcceptSuggestion(assignment); }}>Принять</Button> : null}
              {caps.canPublish ? <Button variant="primary" onClick={() => { props.onPublish(assignment); }}>Опубликовать</Button> : null}
            </div>
          ) : undefined
        }
      >
        {assignmentId === null ? null : assignment === undefined ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Задание недоступно" description="Оно не существует или было удалено." />
        ) : (
          <div className="space-y-5">
            <div role="tablist" aria-label="Разделы задания" className="flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => { setTab(item.id); }}
                  className={`h-8 shrink-0 rounded-control-sm px-2.5 text-[12.5px] font-medium transition ${tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'}`}
                >
                  {item.label}
                  {item.id === 'submissions' && assignment.submissions.length > 0 ? (
                    <span className="ml-1.5 text-ink-disabled">({assignment.submissions.length})</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === 'overview' ? <OverviewTab assignment={assignment} mentorNameOf={mentorNameOf} /> : null}
              {tab === 'submissions' ? <SubmissionsTab assignment={assignment} onOpenFile={handleOpenFile} /> : null}
              {tab === 'history' ? <HistoryTab assignment={assignment} /> : null}
            </div>
          </div>
        )}
      </Drawer>

      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(next) => { if (!next) setPreviewFile(null); }} />
      <FileDetailsModal file={detailsFile} open={detailsFile !== null} onOpenChange={(next) => { if (!next) setDetailsFile(null); }} />
    </>
  );
}

