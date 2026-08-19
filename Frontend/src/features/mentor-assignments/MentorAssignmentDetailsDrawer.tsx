import { CheckCircle2, FileText, Send, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Drawer, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FileDropzone, formatFileSize } from '../../shared/ui/FileDropzone';
import type { PendingFile } from '../../shared/ui/FileDropzone';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import {
  MENTOR_ASSIGNMENT_STATUS_LABEL,
  MENTOR_STATUS_META,
  assignmentCapabilities,
  taskEventLabel,
} from '../mentor/assignments/mentorAssignmentPresentation';
import type { MentorAssignmentRecord } from '../mentor/assignments/mentorAssignmentPresentation';
import { MentorAssignmentPreviewError, submitPreview } from '../mentor/assignments/mentorAssignmentPreviewStore';
import { formatCategoryDateTime } from '../mentor/scope/mentorDateFormat';
import { useMentorScope } from '../mentor/scope/useMentorScope';

const ACCEPT_EXTENSIONS = ['pdf', 'pptx'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type Tab = 'overview' | 'submission' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'submission', label: 'Решение' },
  { id: 'history', label: 'История' },
];

export interface MentorAssignmentDetailsDrawerProps {
  assignment: MentorAssignmentRecord | undefined;
  assignmentId: string | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 text-[13.5px] text-ink">{value}</p>
    </div>
  );
}

function OverviewTab({ assignment }: { assignment: MentorAssignmentRecord }): JSX.Element {
  const scope = useMentorScope();
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">Описание</p>
        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-[20px] text-ink-secondary">
          {assignment.description.length > 0 ? assignment.description : 'Без описания'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Назначил" value={assignment.assignedById ?? '—'} />
        {assignment.assignedAt !== null ? <Field label="Назначено" value={formatCategoryDateTime(assignment.assignedAt, scope.timeZoneId)} /> : null}
        <Field label="Начальный дедлайн" value={formatCategoryDateTime(assignment.initialDueAt, scope.timeZoneId)} />
        <Field label="Текущий дедлайн" value={formatCategoryDateTime(assignment.currentDueAt, scope.timeZoneId)} />
        {assignment.approvedAt !== null ? <Field label="Принято" value={formatCategoryDateTime(assignment.approvedAt, scope.timeZoneId)} /> : null}
      </div>
      {assignment.status === 'Cancelled' && assignment.cancelReason !== null ? (
        <div className="rounded-control-sm border border-danger-border bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger">
          <p className="font-medium">Причина отмены</p>
          <p className="mt-0.5">{assignment.cancelReason}</p>
        </div>
      ) : null}
    </div>
  );
}

function SubmissionForm({ assignment, onSubmitted }: { assignment: MentorAssignmentRecord; onSubmitted: () => void }): JSX.Element {
  const scope = useMentorScope();
  const toast = useToast();
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const readyFiles = pending.filter((f) => f.status === 'ready');
  const hasBlockingFiles = pending.some((f) => f.status === 'uploading' || f.status === 'error');
  const canConfirm = readyFiles.length > 0 && !hasBlockingFiles && !submitting;
  const isOverdueWarning = assignment.status === 'Overdue';

  function handleSubmit(): void {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      submitPreview(scope.mentorId, assignment.id, scope.mentorName, {
        files: readyFiles.map((f) => ({
          id: f.id,
          name: f.file.name,
          extension: f.file.name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'pdf',
          sizeLabel: formatFileSize(f.file.size),
        })),
        comment: comment.trim().length > 0 ? comment.trim() : null,
      });
      toast.success('Решение отправлено на проверку');
      setPending([]);
      setComment('');
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof MentorAssignmentPreviewError ? error.message : 'Не удалось отправить решение');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3.5 rounded-control border border-line p-4">
      <p className="text-[13px] font-semibold text-ink">
        {assignment.submissions.length > 0 ? 'Загрузить исправленную версию' : 'Отправить решение'}
      </p>
      {isOverdueWarning ? (
        <p className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          Дедлайн прошёл — решение будет отмечено как сданное с опозданием.
        </p>
      ) : null}
      <FileDropzone acceptExtensions={ACCEPT_EXTENSIONS} maxSizeBytes={MAX_FILE_SIZE_BYTES} files={pending} onFilesChange={setPending} disabled={submitting} />
      <div>
        <label htmlFor="submission-comment" className="mb-1 block text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">
          Комментарий к работе
        </label>
        <textarea
          id="submission-comment"
          rows={3}
          value={comment}
          onChange={(event) => { setComment(event.target.value); }}
          disabled={submitting}
          placeholder="Например: реализовал все требования задания, основные изменения находятся..."
          className="w-full resize-none rounded-control-sm border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none transition placeholder:text-ink-disabled focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:opacity-60"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="primary" leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />} disabled={!canConfirm} isLoading={submitting} onClick={handleSubmit}>
          Отправить на проверку
        </Button>
      </div>
    </div>
  );
}

function blockedSubmissionReason(assignment: MentorAssignmentRecord): string {
  if (assignment.status === 'Submitted') return 'Решение отправлено и ожидает начала проверки руководителем.';
  if (assignment.status === 'InReview') return 'Руководитель сейчас проверяет отправленное решение.';
  if (assignment.status === 'Approved') return 'Задание принято руководителем.';
  if (assignment.status === 'Cancelled') return 'Задание отменено.';
  if (assignment.status === 'Overdue') return 'Приём работ по этой задаче закрыт. Обратитесь к тимлиду.';
  return 'Загрузка решения сейчас недоступна.';
}

function SubmissionTab({ assignment, onOpenFile }: { assignment: MentorAssignmentRecord; onOpenFile: (file: SubmissionFile) => void }): JSX.Element {
  const scope = useMentorScope();
  const caps = assignmentCapabilities(assignment);
  const latestReview = assignment.submissions.length > 0 ? assignment.submissions[assignment.submissions.length - 1].review : null;

  return (
    <div className="space-y-5">
      {assignment.status === 'NeedsRework' && latestReview !== null ? (
        <div className="space-y-1.5 rounded-control border border-warning-border bg-warning-soft p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-warning">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Требуется доработка
          </p>
          <p className="text-[13px] text-ink-secondary">{latestReview.comment}</p>
          <p className="text-[11.5px] text-ink-muted">{latestReview.reviewerName} · {formatCategoryDateTime(latestReview.createdAt, scope.timeZoneId)}</p>
        </div>
      ) : null}

      {assignment.status === 'Approved' && latestReview !== null ? (
        <div className="space-y-1.5 rounded-control border border-success-border bg-success-soft p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Принято
          </p>
          {latestReview.comment !== null ? <p className="text-[13px] text-ink-secondary">{latestReview.comment}</p> : null}
          <p className="text-[11.5px] text-ink-muted">{latestReview.reviewerName} · {formatCategoryDateTime(latestReview.createdAt, scope.timeZoneId)}</p>
        </div>
      ) : null}

      {caps.canSubmit ? (
        <SubmissionForm assignment={assignment} onSubmitted={() => {}} />
      ) : (
        <div className="rounded-control border border-line bg-surface-muted px-4 py-3.5 text-[13px] text-ink-secondary">
          {blockedSubmissionReason(assignment)}
        </div>
      )}

      <div>
        <p className="mb-2.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-muted">
          История версий {assignment.submissions.length > 0 ? `(${String(assignment.submissions.length)})` : ''}
        </p>
        {assignment.submissions.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Решение ещё не отправлено" description="Загрузите файл выше, чтобы отправить его на проверку." />
        ) : (
          <div className="space-y-3">
            {[...assignment.submissions].reverse().map((submission, index) => (
              <div key={submission.id} className="rounded-control border border-line p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    Версия {submission.versionNumber}{index === 0 ? ' · текущая' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {submission.isLate ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">С опозданием</span> : null}
                    <span className="text-[12px] text-ink-muted">{formatCategoryDateTime(submission.submittedAt, scope.timeZoneId)}</span>
                  </div>
                </div>
                {submission.comment !== null ? <p className="mt-2 text-[13px] text-ink-secondary">{submission.comment}</p> : null}
                <div className="mt-2.5 space-y-1.5">
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
                  <div className={`mt-2.5 rounded-control-sm px-3 py-2 text-[12.5px] ${submission.review.decision === 'Approved' ? 'border border-success-border bg-success-soft text-success' : 'border border-warning-border bg-warning-soft text-warning'}`}>
                    <p className="font-medium">{submission.review.decision === 'Approved' ? 'Принято' : 'На доработку'} · {submission.review.reviewerName}</p>
                    {submission.review.comment !== null ? <p className="mt-0.5">{submission.review.comment}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ assignment }: { assignment: MentorAssignmentRecord }): JSX.Element {
  const scope = useMentorScope();
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

/**
 * Task Details Mentor — не отдельная "кнопка отправить" сбоку, а
 * полноценный Submission Workspace внутри вкладки «Решение»: upload,
 * комментарий, feedback руководителя и история версий в одном месте.
 * Все действия строго по `assignmentCapabilities()` — Mentor не может
 * поставить себе Approved, отменить, переназначить или начать проверку.
 */
export function MentorAssignmentDetailsDrawer({ assignment, assignmentId, onClose }: MentorAssignmentDetailsDrawerProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('overview');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);

  useEffect(() => {
    if (assignmentId !== null) setTab(assignment?.status === 'NeedsRework' || assignment?.status === 'Assigned' ? 'submission' : 'overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- переключаем вкладку только при смене открытого задания
  }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? MENTOR_STATUS_META[assignment.status] : null;

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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium" role="status" aria-label={`Статус: ${MENTOR_ASSIGNMENT_STATUS_LABEL[assignment.status]}`}>
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
              <span className={statusMeta.text}>{MENTOR_ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
            </span>
          ) : undefined
        }
      >
        {assignmentId === null ? null : assignment === undefined ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Задание недоступно" description="Оно не существует или было отменено." />
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
                  {item.id === 'submission' && assignment.submissions.length > 0 ? (
                    <span className="ml-1.5 text-ink-disabled">({assignment.submissions.length})</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === 'overview' ? <OverviewTab assignment={assignment} /> : null}
              {tab === 'submission' ? <SubmissionTab assignment={assignment} onOpenFile={handleOpenFile} /> : null}
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
