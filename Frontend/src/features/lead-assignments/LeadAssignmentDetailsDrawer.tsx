import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

import { Drawer } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { formatCategoryDateTime } from '../lead/scope/leadDateFormat';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { assignmentCapabilities, averageVersionsLabel, LEAD_STATUS_META, sourceLabel, taskEventLabel } from '../lead/assignments/leadAssignmentPresentation';
import { mentorNameOf } from '../lead/scope/leadScopedData';

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
}

function Field({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 text-[13.5px] text-ink">{value}</p>
    </div>
  );
}

function OverviewTab({ assignment }: { assignment: LeadAssignmentRecord }): JSX.Element {
  const scope = useLeadScope();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">Описание</p>
        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[20px] text-ink-secondary">
          {assignment.description.length > 0 ? assignment.description : 'Без описания'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ментор" value={mentorNameOf(scope.categoryId, assignment.mentorId)} />
        <Field label="Источник" value={sourceLabel(assignment.source)} />
        <Field label="Начальный дедлайн" value={formatCategoryDateTime(assignment.initialDueAt, scope.timeZoneId)} />
        <Field label="Текущий дедлайн" value={formatCategoryDateTime(assignment.currentDueAt, scope.timeZoneId)} />
        {assignment.assignedAt !== null ? <Field label="Назначено" value={formatCategoryDateTime(assignment.assignedAt, scope.timeZoneId)} /> : null}
        {assignment.approvedAt !== null ? <Field label="Одобрено" value={formatCategoryDateTime(assignment.approvedAt, scope.timeZoneId)} /> : null}
        {assignment.overdueAt !== null ? <Field label="Просрочено с" value={formatCategoryDateTime(assignment.overdueAt, scope.timeZoneId)} /> : null}
        <Field label="Версий решения" value={averageVersionsLabel(assignment)} />
      </div>
      {assignment.status === 'Cancelled' && assignment.cancelReason !== null ? (
        <div className="rounded-control-sm border border-danger-border bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger">
          <p className="font-medium">Причина отмены</p>
          <p className="mt-0.5">{assignment.cancelReason}</p>
        </div>
      ) : null}
      {assignment.status === 'NeedsRework' ? (() => {
        const latestReview = assignment.submissions[assignment.submissions.length - 1]?.review;
        return latestReview !== null && latestReview !== undefined ? (
          <div className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2.5 text-[12.5px] text-warning">
            <p className="font-medium">Комментарий на доработку</p>
            <p className="mt-0.5">{latestReview.comment}</p>
          </div>
        ) : null;
      })() : null}
    </div>
  );
}

function SubmissionsTab({ assignment, onOpenFile }: { assignment: LeadAssignmentRecord; onOpenFile: (file: SubmissionFile) => void }): JSX.Element {
  const scope = useLeadScope();

  if (assignment.submissions.length === 0) {
    return <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Решений пока нет" description="Ментор ещё не отправлял ни одной версии по этому заданию." />;
  }

  return (
    <div className="space-y-4">
      {[...assignment.submissions].reverse().map((submission) => (
        <div key={submission.id} className="rounded-control border border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-semibold text-ink">Версия {submission.versionNumber}</p>
            <div className="flex items-center gap-2">
              {submission.isLate ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Сдано с опозданием</span> : null}
              <span className="text-[12px] text-ink-muted">{formatCategoryDateTime(submission.submittedAt, scope.timeZoneId)}</span>
            </div>
          </div>
          {submission.comment !== null ? <p className="mt-2 text-[13px] text-ink-secondary">{submission.comment}</p> : null}
          <div className="mt-3 space-y-2">
            {submission.files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => { onOpenFile({ ...file, uploadedLabel: formatCategoryDateTime(submission.submittedAt, scope.timeZoneId) }); }}
                className="flex w-full items-center gap-2.5 rounded-control-sm border border-line px-3 py-2 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{file.name}</span>
                <span className="shrink-0 text-[11.5px] text-ink-muted">{file.sizeLabel}</span>
              </button>
            ))}
          </div>
          {submission.review !== null ? (
            <div className={`mt-3 rounded-control-sm px-3 py-2.5 text-[12.5px] ${submission.review.decision === 'Approved' ? 'border border-success-border bg-success-soft text-success' : 'border border-warning-border bg-warning-soft text-warning'}`}>
              <p className="font-medium">{submission.review.decision === 'Approved' ? 'Одобрено' : 'На доработку'} · {submission.review.reviewerName}</p>
              {submission.review.comment !== null ? <p className="mt-0.5">{submission.review.comment}</p> : null}
            </div>
          ) : null}
        </div>
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
  const { assignment, assignmentId, onClose } = props;
  const [tab, setTab] = useState<Tab>('overview');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);

  useEffect(() => {
    if (assignmentId !== null) setTab('overview');
  }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? LEAD_STATUS_META[assignment.status] : null;
  const caps = assignment !== undefined ? assignmentCapabilities(assignment) : null;

  function handleOpenFile(file: SubmissionFile): void {
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
              {tab === 'overview' ? <OverviewTab assignment={assignment} /> : null}
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

