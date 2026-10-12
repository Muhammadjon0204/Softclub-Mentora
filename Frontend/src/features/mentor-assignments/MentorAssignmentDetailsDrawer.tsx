import { AlertTriangle, AlignLeft, CalendarClock, CalendarPlus, CheckCircle2, Eye, FileText, Flag, Hourglass, Send, UserRound, Wrench, XCircle } from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

import { Drawer, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { MetaTiles, Notice, QuoteBlock, SectionLabel, TextPanel } from '../../shared/ui/DetailBlocks';
import type { BlockTone, MetaItem } from '../../shared/ui/DetailBlocks';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FileDropzone } from '../../shared/ui/FileDropzone';
import type { PendingFile } from '../../shared/ui/FileDropzone';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import { SubmissionVersionCard } from '../assignment-details/SubmissionVersionCard';
import type { LeadSubmissionFile } from '../../mocks/ui-preview/leadAssignments.preview';
import {
  MENTOR_ASSIGNMENT_STATUS_LABEL,
  MENTOR_STATUS_META,
  assignmentCapabilities,
  taskEventLabel,
} from '../mentor/assignments/mentorAssignmentPresentation';
import type { MentorAssignmentRecord } from '../mentor/assignments/mentorAssignmentPresentation';
import { formatCategoryDateTime } from '../mentor/scope/mentorDateFormat';
import { useMentorScope } from '../mentor/scope/useMentorScope';
import { useSubmitAssignment } from './useSubmitAssignment';

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

function OverviewTab({ assignment }: { assignment: MentorAssignmentRecord }): JSX.Element {
  const scope = useMentorScope();
  const format = (ms: number): string => formatCategoryDateTime(ms, scope.timeZoneId);
  const deadlineMoved = assignment.currentDueAt !== assignment.initialDueAt;

  const items: MetaItem[] = [
    /*
      Phase 1E contract map, Open Question #3 (resolved): `AssignedById` is a raw, unmasked Guid a
      Mentor cannot resolve to a name (`GET /users` is Lead/Admin-only). Same masking principle as
      `EVT-004`'s `ActorLabel` for the assignment's own event history — a generic role label, never
      an invented name.
    */
    { icon: UserRound, label: 'Назначил', value: assignment.assignedById !== null ? 'Руководитель направления' : '—', tone: 'brand' },
    ...(assignment.assignedAt !== null ? [{ icon: CalendarPlus, label: 'Назначено', value: format(assignment.assignedAt) }] : []),
    { icon: CalendarClock, label: deadlineMoved ? 'Текущий дедлайн' : 'Дедлайн', value: format(assignment.currentDueAt), tone: 'warning' as const },
    ...(deadlineMoved ? [{ icon: Flag, label: 'Начальный дедлайн', value: format(assignment.initialDueAt) }] : []),
    ...(assignment.approvedAt !== null ? [{ icon: CheckCircle2, label: 'Принято', value: format(assignment.approvedAt), tone: 'success' as const }] : []),
  ];

  return (
    <div className="space-y-5">
      <TextPanel icon={AlignLeft} title="Описание задания" text={assignment.description} emptyText="Руководитель не добавил описание" />
      <MetaTiles items={items} />
      {assignment.status === 'Cancelled' && assignment.cancelReason !== null ? (
        <Notice tone="danger" icon={XCircle} title="Задание отменено">{assignment.cancelReason}</Notice>
      ) : null}
    </div>
  );
}

/**
 * SB1 (`POST /assignments/{id}/submissions`) — real upload networking. `handleSubmit` sends one real
 * `POST` per ready file, sequentially (`useSubmitAssignment.ts`'s `submitFiles`) — each call is its own
 * new `VersionNumber` on the real backend and its own real `Assigned/NeedsRework/Overdue → Submitted`
 * transition, so a partial failure across several files is a partial REAL success, not something to
 * roll back or hide (Phase 1E contract map, Open Question #2 — resolved). `onSubmitted` invalidates the
 * real queries `useResolvedMentorAssignment` reads from, so the assignment's new status/version show up
 * from the actual API response, not an optimistic local patch.
 *
 * A file is optional (2026-09-28) — not every task produces one (e.g. "call the parents"), so
 * `canConfirm` accepts a comment alone. When both a file and a comment are given, the comment rides
 * along with the last file's `POST` (`useSubmitAssignment.ts`), matching "one comment describes the
 * whole submission," not each version.
 */
function SubmissionForm({ assignment, onSubmitted }: { assignment: MentorAssignmentRecord; onSubmitted: () => void }): JSX.Element {
  const toast = useToast();
  const { isSubmitting, submitFiles } = useSubmitAssignment();
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [comment, setComment] = useState('');

  const readyFiles = pending.filter((f) => f.status === 'ready');
  const hasBlockingFiles = pending.some((f) => f.status === 'uploading' || f.status === 'error');
  const hasComment = comment.trim().length > 0;
  // A file or a comment, at least one (2026-09-28) — not every task produces a file to attach (e.g.
  // "call the parents"), mirrors the backend's own `ck_submissions_file_or_comment` constraint.
  const canConfirm = (readyFiles.length > 0 || hasComment) && !hasBlockingFiles && !isSubmitting;
  const isOverdueWarning = assignment.status === 'Overdue';

  function updatePendingFile(id: string, patch: Partial<Pick<PendingFile, 'status' | 'progress' | 'errorMessage'>>): void {
    setPending((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function handleSubmit(): Promise<void> {
    if (!canConfirm) return;
    const attempted = readyFiles;
    const results = await submitFiles(assignment.id, attempted, hasComment ? comment : null, updatePendingFile);
    const succeeded = results.filter((r) => r.outcome === 'success');
    const failed = results.filter((r) => r.outcome === 'error');

    // Succeeded files are real `Submission` versions now — drop them from the "to send" queue so a
    // second click can't re-upload the same bytes (real SHA-256 dedup would reject it as
    // `SUBMISSION_DUPLICATE_CONTENT`). Failed files stay, already marked `'error'` by `submitFiles`, so
    // "Повторить" queues them for the next attempt.
    setPending((prev) => prev.filter((f) => !succeeded.some((r) => r.file.id === f.id)));

    if (failed.length === 0) {
      toast.success(attempted.length > 1 ? `Все файлы (${String(attempted.length)}) отправлены на проверку` : 'Решение отправлено на проверку');
      setComment('');
    } else if (succeeded.length > 0) {
      const summary = results
        .map((r, index) => (r.outcome === 'success' ? `файл ${String(index + 1)} из ${String(results.length)} отправлен` : `файл ${String(index + 1)} — ошибка: ${r.message ?? 'не удалось отправить'}`))
        .join(', ');
      toast.error(summary.charAt(0).toUpperCase() + summary.slice(1));
    } else {
      toast.error(failed[0]?.message ?? 'Не удалось отправить решение');
    }

    if (succeeded.length > 0) onSubmitted();
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-surface sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Send className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-ink">{assignment.submissions.length > 0 ? 'Отправить исправленную версию' : 'Отправить решение'}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Файл, комментарий или и то, и другое — руководитель получит уведомление.</p>
        </div>
      </div>
      {isOverdueWarning ? (
        <p className="rounded-control-sm border border-warning-border bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          Дедлайн прошёл — решение будет отмечено как сданное с опозданием.
        </p>
      ) : null}
      <FileDropzone acceptExtensions={ACCEPT_EXTENSIONS} maxSizeBytes={MAX_FILE_SIZE_BYTES} files={pending} onFilesChange={setPending} disabled={isSubmitting} />
      <div>
        <label htmlFor="submission-comment" className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
          Комментарий к работе{readyFiles.length > 0 ? ' (необязательно)' : ''}
        </label>
        <textarea
          id="submission-comment"
          rows={3}
          value={comment}
          onChange={(event) => { setComment(event.target.value); }}
          disabled={isSubmitting}
          placeholder="Например: позвонил родителям студентов и обсудил результаты, файл прикладывать не требуется"
          className="min-h-[88px] w-full resize-none rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-ink outline-none transition placeholder:text-ink-disabled focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        />
        <p className="mt-1 text-[11.5px] text-ink-muted">Если задание не предполагает файл — достаточно комментария. Иначе можно приложить и то, и другое.</p>
      </div>
      <div className="flex justify-end border-t border-divider pt-4">
        <Button variant="primary" leadingIcon={<Send className="h-4 w-4" aria-hidden="true" />} disabled={!canConfirm} isLoading={isSubmitting} onClick={() => { void handleSubmit(); }}>
          Отправить на проверку
        </Button>
      </div>
    </div>
  );
}

const BLOCKED_NOTICE: Partial<Record<MentorAssignmentRecord['status'], { tone: BlockTone; icon: ComponentType<{ className?: string }>; title: string; text: string }>> = {
  Submitted: { tone: 'info', icon: Hourglass, title: 'Ожидает проверки', text: 'Решение отправлено. Руководитель скоро начнёт проверку — уведомление придёт в Telegram и на почту.' },
  InReview: { tone: 'brand', icon: Eye, title: 'Идёт проверка', text: 'Руководитель сейчас смотрит ваше решение.' },
  Approved: { tone: 'success', icon: CheckCircle2, title: 'Задание принято', text: 'Работа закрыта, больше ничего делать не нужно.' },
  Cancelled: { tone: 'neutral', icon: XCircle, title: 'Задание отменено', text: 'Приём решений закрыт.' },
  Overdue: { tone: 'danger', icon: AlertTriangle, title: 'Срок истёк', text: 'Приём работ по этой задаче закрыт. Обратитесь к тимлиду.' },
};

function SubmissionTab({ assignment, onOpenFile }: { assignment: MentorAssignmentRecord; onOpenFile: (file: LeadSubmissionFile, submittedAt: number) => void }): JSX.Element {
  const scope = useMentorScope();
  const caps = assignmentCapabilities(assignment);
  const latestReview = assignment.submissions.length > 0 ? assignment.submissions[assignment.submissions.length - 1].review : null;
  const format = (ms: number): string => formatCategoryDateTime(ms, scope.timeZoneId);
  const blocked = BLOCKED_NOTICE[assignment.status] ?? { tone: 'neutral' as const, icon: FileText, title: 'Отправка недоступна', text: 'Загрузка решения сейчас недоступна.' };

  return (
    <div className="space-y-5">
      {assignment.status === 'NeedsRework' && latestReview !== null ? (
        <div className="space-y-3">
          <Notice tone="warning" icon={Wrench} title="Требуется доработка">
            Исправьте замечания и отправьте новую версию до {format(assignment.currentDueAt)}.
          </Notice>
          {latestReview.comment !== null ? (
            <QuoteBlock tone="warning" label={`Комментарий · ${latestReview.reviewerName}`} text={latestReview.comment} meta={format(latestReview.createdAt)} />
          ) : null}
        </div>
      ) : null}

      {caps.canSubmit ? (
        <SubmissionForm assignment={assignment} onSubmitted={() => {}} />
      ) : (
        <Notice tone={blocked.tone} icon={blocked.icon} title={blocked.title}>{blocked.text}</Notice>
      )}

      {assignment.status === 'Approved' && latestReview !== null && latestReview.comment !== null ? (
        <QuoteBlock tone="success" label={`Отзыв · ${latestReview.reviewerName}`} text={latestReview.comment} meta={format(latestReview.createdAt)} />
      ) : null}

      <div>
        <SectionLabel>История версий {assignment.submissions.length > 0 ? `· ${String(assignment.submissions.length)}` : ''}</SectionLabel>
        {assignment.submissions.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Решение ещё не отправлено" description="Загрузите файл или напишите комментарий выше, чтобы отправить работу на проверку." />
        ) : (
          <div className="space-y-3">
            {[...assignment.submissions].reverse().map((submission, index) => (
              <SubmissionVersionCard key={submission.id} submission={submission} isCurrent={index === 0} commentLabel="Ваш комментарий" formatDate={format} onOpenFile={onOpenFile} />
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
  const scope = useMentorScope();
  const [tab, setTab] = useState<Tab>('overview');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);

  useEffect(() => {
    if (assignmentId !== null) setTab(assignment?.status === 'NeedsRework' || assignment?.status === 'Assigned' ? 'submission' : 'overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- переключаем вкладку только при смене открытого задания
  }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? MENTOR_STATUS_META[assignment.status] : null;

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
