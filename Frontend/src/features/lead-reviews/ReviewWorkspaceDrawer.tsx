import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, FileText, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Drawer } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FormField, FormInput, FormTextarea } from '../../shared/ui/FormField';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import { LEAD_STATUS_META, sourceLabel } from '../lead/assignments/leadAssignmentPresentation';
import { formatCategoryDateTime, formatRelative, leadNow, localInputToUtcMs } from '../lead/scope/leadDateFormat';
import { useLeadScope } from '../lead/scope/useLeadScope';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import { approveSchema, needsReworkSchema } from './reviewDecision.schema';
import type { ApproveFormValues, NeedsReworkFormValues } from './reviewDecision.schema';

export interface ReviewWorkspaceDrawerProps {
  assignment: LeadAssignmentRecord | undefined;
  assignmentId: string | null;
  onClose: () => void;
  onStartReview: (a: LeadAssignmentRecord) => void;
  onApprove: (a: LeadAssignmentRecord, comment: string | null) => void;
  onNeedsRework: (a: LeadAssignmentRecord, comment: string, reworkDueAtMs: number) => void;
  mentorNameOf: (mentorId: string) => string;
}

type DecisionMode = 'none' | 'approve' | 'rework';

function ApproveForm({ onSubmit }: { onSubmit: (comment: string | null) => void }): JSX.Element {
  const { register, handleSubmit, formState: { errors } } = useForm<ApproveFormValues>({ resolver: zodResolver(approveSchema), defaultValues: { comment: '' } });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => { onSubmit(values.comment !== undefined && values.comment.length > 0 ? values.comment : null); })(event);
      }}
      className="space-y-3 rounded-control border border-success-border bg-success-soft p-4"
    >
      <FormField label="Комментарий" htmlFor="approve-comment" hint="Необязательно" error={errors.comment?.message}>
        <FormTextarea id="approve-comment" rows={2} {...register('comment')} />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="primary">Подтвердить одобрение</Button>
      </div>
    </form>
  );
}

function NeedsReworkForm({ timeZoneId, onSubmit }: { timeZoneId: string; onSubmit: (comment: string, reworkDueAtMs: number) => void }): JSX.Element {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<NeedsReworkFormValues>({
    resolver: zodResolver(needsReworkSchema),
    defaultValues: { comment: '', reworkDueDate: '', reworkDueTime: '23:59' },
  });

  const [dueDate, dueTime] = watch(['reworkDueDate', 'reworkDueTime']);
  const resolvedMs = dueDate.length > 0 && dueTime.length > 0 ? localInputToUtcMs(dueDate, dueTime, timeZoneId) : null;
  const inPast = resolvedMs !== null && resolvedMs <= leadNow();

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => {
          const ms = localInputToUtcMs(values.reworkDueDate, values.reworkDueTime, timeZoneId);
          if (ms === null || ms <= leadNow()) return;
          onSubmit(values.comment, ms);
        })(event);
      }}
      className="space-y-3 rounded-control border border-warning-border bg-warning-soft p-4"
    >
      <FormField label="Комментарий" htmlFor="rework-comment" required error={errors.comment?.message} hint="10–3000 символов — что нужно исправить">
        <FormTextarea id="rework-comment" rows={3} invalid={errors.comment !== undefined} {...register('comment')} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Новый дедлайн" htmlFor="rework-date" required error={errors.reworkDueDate?.message}>
          <FormInput id="rework-date" type="date" invalid={errors.reworkDueDate !== undefined} {...register('reworkDueDate')} />
        </FormField>
        <FormField label="Время" htmlFor="rework-time" required error={errors.reworkDueTime?.message}>
          <FormInput id="rework-time" type="time" invalid={errors.reworkDueTime !== undefined} {...register('reworkDueTime')} />
        </FormField>
      </div>
      {inPast ? <p className="text-[12px] text-danger">Новый дедлайн обязан быть в будущем</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary">Вернуть на доработку</Button>
      </div>
    </form>
  );
}

/**
 * `/lead/submissions/:id` из ТЗ 24.4 реализован как xl-drawer поверх очереди
 * проверки (раздел 26 задачи Phase 3 — тот же приём, что Admin использует для
 * detail-панелей вместо отдельного nested route). Решение доступно только из
 * `InReview` (REV-003); вне этого статуса форма решения не рендерится вовсе —
 * не просто задизейблена.
 */
export function ReviewWorkspaceDrawer({ assignment, assignmentId, onClose, onStartReview, onApprove, onNeedsRework, mentorNameOf }: ReviewWorkspaceDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const [mode, setMode] = useState<DecisionMode>('none');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);

  useEffect(() => { setMode('none'); }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? LEAD_STATUS_META[assignment.status] : null;
  const latest = assignment !== undefined && assignment.submissions.length > 0 ? assignment.submissions[assignment.submissions.length - 1] : undefined;
  const previous = assignment !== undefined ? assignment.submissions.slice(0, -1).reverse() : [];

  function handleOpenFile(file: SubmissionFile): void {
    if (file.extension === 'pdf') setPreviewFile(file);
    else setDetailsFile(file);
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={assignment?.title ?? 'Проверка решения'}
        description={assignment !== undefined ? `${mentorNameOf(assignment.mentorId)} · Версия ${String(latest?.versionNumber ?? '—')}` : undefined}
        size="xl"
        headerActions={
          assignment !== undefined && statusMeta !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium">
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
              <span className={statusMeta.text}>{LEAD_ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
            </span>
          ) : undefined
        }
      >
        {assignmentId === null ? null : assignment === undefined ? (
          <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Решение недоступно" description="Оно не существует или не ожидает проверки." />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-control border border-line p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Ментор</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">{mentorNameOf(assignment.mentorId)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Источник</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">{sourceLabel(assignment.source)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Дедлайн</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">{formatCategoryDateTime(assignment.currentDueAt, scope.timeZoneId)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">В очереди с</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">
                  {latest !== undefined ? formatRelative(latest.submittedAt).label : '—'}
                </p>
              </div>
            </div>

            {latest === undefined ? (
              <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Нет отправленного решения" description="Ментор ещё не загрузил файл по этой версии." />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-semibold text-ink">Текущая версия ({latest.versionNumber})</h3>
                  {latest.isLate ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Сдано с опозданием</span> : null}
                </div>
                {latest.comment !== null ? <p className="text-[13px] text-ink-secondary">{latest.comment}</p> : null}
                <div className="space-y-2">
                  {latest.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => { handleOpenFile({ ...file, uploadedLabel: formatCategoryDateTime(latest.submittedAt, scope.timeZoneId) }); }}
                      className="flex w-full items-center gap-2.5 rounded-control-sm border border-line px-3 py-2.5 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{file.name}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-muted">{file.sizeLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {previous.length > 0 ? (
              <details className="rounded-control border border-line p-4">
                <summary className="cursor-pointer text-[13px] font-medium text-ink-secondary">Предыдущие попытки ({previous.length})</summary>
                <div className="mt-3 space-y-3">
                  {previous.map((submission) => (
                    <div key={submission.id} className="rounded-control-sm border border-divider p-3">
                      <p className="text-[12.5px] font-medium text-ink">Версия {submission.versionNumber} · {formatCategoryDateTime(submission.submittedAt, scope.timeZoneId)}</p>
                      {submission.review !== null ? (
                        <p className={`mt-1 text-[12.5px] ${submission.review.decision === 'Approved' ? 'text-success' : 'text-warning'}`}>
                          {submission.review.decision === 'Approved' ? 'Одобрено' : 'На доработку'}
                          {submission.review.comment !== null ? `: ${submission.review.comment}` : ''}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {assignment.status === 'Submitted' ? (
              <div className="flex items-center justify-between rounded-control border border-line bg-surface-muted p-4">
                <p className="text-[13px] text-ink-secondary">Решение в очереди — проверка ещё не начата.</p>
                <Button variant="primary" onClick={() => { onStartReview(assignment); }}>Начать проверку</Button>
              </div>
            ) : null}

            {assignment.status === 'InReview' ? (
              <div className="space-y-3">
                {mode === 'none' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} onClick={() => { setMode('approve'); }}>
                      Одобрить
                    </Button>
                    <Button variant="secondary" leadingIcon={<Wrench className="h-4 w-4" aria-hidden="true" />} onClick={() => { setMode('rework'); }}>
                      На доработку
                    </Button>
                  </div>
                ) : null}
                {mode === 'approve' ? <ApproveForm onSubmit={(comment) => { onApprove(assignment, comment); setMode('none'); }} /> : null}
                {mode === 'rework' ? <NeedsReworkForm timeZoneId={scope.timeZoneId} onSubmit={(comment, dueAt) => { onNeedsRework(assignment, comment, dueAt); setMode('none'); }} /> : null}
                {mode !== 'none' ? (
                  <button type="button" onClick={() => { setMode('none'); }} className="text-[12.5px] font-medium text-ink-muted hover:text-ink">
                    Отменить решение
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Drawer>

      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(next) => { if (!next) setPreviewFile(null); }} />
      <FileDetailsModal file={detailsFile} open={detailsFile !== null} onOpenChange={(next) => { if (!next) setDetailsFile(null); }} />
    </>
  );
}
