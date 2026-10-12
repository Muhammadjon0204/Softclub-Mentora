import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, CheckCircle2, FileText, Hourglass, RotateCcw, Tag, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { dayKeyOf } from '../../lib/calendarMath';
import { Drawer } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { formatDayKeyRu, todayKey } from '../../lib/dayKeys';
import { DatePicker } from '../../shared/ui/DatePicker';
import { MetaTiles, Notice, SectionLabel } from '../../shared/ui/DetailBlocks';
import { EmptyState } from '../../shared/ui/EmptyState';
import { FormField, FormTextarea } from '../../shared/ui/FormField';
import { TimePicker } from '../../shared/ui/TimePicker';
import type { SubmissionFile } from '../admin-assignments/assignmentPresentation';
import { FileDetailsModal } from '../admin-assignments/FileDetailsModal';
import { FilePreviewModal } from '../admin-assignments/FilePreviewModal';
import { SubmissionVersionCard } from '../assignment-details/SubmissionVersionCard';
import { LEAD_STATUS_META, sourceLabel } from '../lead/assignments/leadAssignmentPresentation';
import { formatCategoryDateTime, formatRelative, leadNow, localInputToUtcMs } from '../lead/scope/leadDateFormat';
import { useLeadScope } from '../lead/scope/useLeadScope';
import type { LeadAssignmentRecord, LeadSubmissionFile } from '../../mocks/ui-preview/leadAssignments.preview';
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

const APPROVE_PHRASES = ['Отличная работа!', 'Всё верно, спасибо', 'Принято, так держать'];
const COMMENT_MAX = 3000;

/** Шапка формы решения: иконка в цветном круге, заголовок, кому и что уйдёт. */
function DecisionHeader({ icon: Icon, tone, title, subtitle }: { icon: ComponentType<{ className?: string }>; tone: 'success' | 'warning'; title: string; subtitle: string }): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone === 'success' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function DecisionPanel({ children }: { children: ReactNode }): JSX.Element {
  return <div className="space-y-4 rounded-card border border-line bg-surface p-4 shadow-surface motion-safe:animate-fade-in sm:p-5">{children}</div>;
}

function ApproveForm({ onSubmit, onCancel }: { onSubmit: (comment: string | null) => void; onCancel: () => void }): JSX.Element {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ApproveFormValues>({ resolver: zodResolver(approveSchema), defaultValues: { comment: '' } });
  const comment = watch('comment') ?? '';

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => { onSubmit(values.comment !== undefined && values.comment.trim().length > 0 ? values.comment.trim() : null); })(event);
      }}
    >
      <DecisionPanel>
        <DecisionHeader icon={CheckCircle2} tone="success" title="Принять работу" subtitle="Ментор сразу получит уведомление в Telegram и на почту." />

        <FormField label="Комментарий для ментора" htmlFor="approve-comment" hint="Необязательно — пара тёплых слов мотивирует" error={errors.comment?.message}>
          <FormTextarea id="approve-comment" rows={3} placeholder="Например: аккуратно и в срок, спасибо!" {...register('comment')} />
        </FormField>

        <div className="flex flex-wrap gap-1.5">
          {APPROVE_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => { setValue('comment', comment.trim().length > 0 ? `${comment.trim()} ${phrase}` : phrase, { shouldDirty: true }); }}
              className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-ink-secondary transition hover:border-brand hover:text-brand"
            >
              {phrase}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-divider pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button type="submit" variant="primary" leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>Принять работу</Button>
        </div>
      </DecisionPanel>
    </form>
  );
}

function NeedsReworkForm({
  assignment,
  timeZoneId,
  onSubmit,
  onCancel,
}: {
  assignment: LeadAssignmentRecord;
  timeZoneId: string;
  onSubmit: (comment: string, reworkDueAtMs: number) => void;
  onCancel: () => void;
}): JSX.Element {
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<NeedsReworkFormValues>({
    resolver: zodResolver(needsReworkSchema),
    defaultValues: { comment: '', reworkDueDate: '', reworkDueTime: '23:59' },
  });

  // Сервер не примет срок раньше первоначального дедлайна — раньше этой даты календарь не пускает.
  const initialDueKey = dayKeyOf(assignment.initialDueAt, timeZoneId);
  const minKey = initialDueKey > todayKey() ? initialDueKey : todayKey();

  const [comment, dueDate, dueTime] = watch(['comment', 'reworkDueDate', 'reworkDueTime']);
  const resolvedMs = dueDate.length > 0 && dueTime.length > 0 ? localInputToUtcMs(dueDate, dueTime, timeZoneId) : null;
  const inPast = resolvedMs !== null && resolvedMs <= leadNow();
  const beforeInitial = resolvedMs !== null && resolvedMs < assignment.initialDueAt;

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit((values) => {
          const ms = localInputToUtcMs(values.reworkDueDate, values.reworkDueTime, timeZoneId);
          if (ms === null || ms <= leadNow() || ms < assignment.initialDueAt) return;
          onSubmit(values.comment.trim(), ms);
        })(event);
      }}
    >
      <DecisionPanel>
        <DecisionHeader icon={RotateCcw} tone="warning" title="Вернуть на доработку" subtitle="Ментор увидит ваш комментарий в приложении и в Telegram." />

        <FormField label="Что нужно исправить" htmlFor="rework-comment" required error={errors.comment?.message}>
          <FormTextarea
            id="rework-comment"
            rows={4}
            invalid={errors.comment !== undefined}
            placeholder="Опишите конкретно: что не так и как должно быть. Например: добавь разбор по каждому студенту ниже 80 баллов."
            {...register('comment')}
          />
          <div className="mt-1 flex justify-between text-[11.5px] text-ink-muted">
            <span>Минимум 10 символов</span>
            <span className={`tabular-nums ${comment.length > COMMENT_MAX ? 'text-danger' : ''}`}>{comment.length} / {COMMENT_MAX}</span>
          </div>
        </FormField>

        <div>
          <SectionLabel>Новый срок</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <FormField label="Дата" htmlFor="rework-date" required error={errors.reworkDueDate?.message}>
              <Controller
                control={control}
                name="reworkDueDate"
                render={({ field }) => <DatePicker id="rework-date" value={field.value} onChange={field.onChange} min={minKey} invalid={errors.reworkDueDate !== undefined} />}
              />
            </FormField>
            <FormField label="Время" htmlFor="rework-time" required error={errors.reworkDueTime?.message}>
              <Controller
                control={control}
                name="reworkDueTime"
                render={({ field }) => <TimePicker id="rework-time" value={field.value} onChange={field.onChange} invalid={errors.reworkDueTime !== undefined} />}
              />
            </FormField>
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-muted">
            Не раньше первоначального дедлайна — {formatDayKeyRu(initialDueKey)}. Время по {timeZoneId}.
          </p>
          {inPast ? <p className="mt-1 text-[12px] text-danger">Новый срок должен быть в будущем</p> : null}
          {!inPast && beforeInitial ? <p className="mt-1 text-[12px] text-danger">Новый срок не может быть раньше первоначального дедлайна</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-divider pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button type="submit" variant="primary" leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>Вернуть на доработку</Button>
        </div>
      </DecisionPanel>
    </form>
  );
}

/** Выбор решения: две карточки вместо двух одинаковых кнопок. */
function DecisionChoice({ onApprove, onRework }: { onApprove: () => void; onRework: () => void }): JSX.Element {
  const card = 'group flex items-start gap-3 rounded-card border border-line bg-surface p-4 text-left transition hover:-translate-y-px hover:shadow-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  return (
    <div>
      <SectionLabel>Ваше решение</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={onApprove} className={`${card} hover:border-success`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">Принять</span>
            <span className="mt-0.5 block text-[12px] text-ink-muted">Работа выполнена, задание закроется</span>
          </span>
        </button>
        <button type="button" onClick={onRework} className={`${card} hover:border-warning`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-soft text-warning">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">На доработку</span>
            <span className="mt-0.5 block text-[12px] text-ink-muted">Объясните, что исправить, и дайте новый срок</span>
          </span>
        </button>
      </div>
    </div>
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
  const formatDate = (ms: number): string => formatCategoryDateTime(ms, scope.timeZoneId);

  function handleOpenFile(file: LeadSubmissionFile, submittedAt: number): void {
    const entry: SubmissionFile = { ...file, uploadedLabel: formatDate(submittedAt) };
    if (file.extension === 'pdf') setPreviewFile(entry);
    else setDetailsFile(entry);
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
            <MetaTiles
              columns={4}
              items={[
                { icon: UserRound, label: 'Ментор', value: mentorNameOf(assignment.mentorId), tone: 'brand' },
                { icon: Tag, label: 'Источник', value: sourceLabel(assignment.source) },
                { icon: CalendarClock, label: 'Дедлайн', value: formatDate(assignment.currentDueAt) },
                { icon: Hourglass, label: 'В очереди', value: latest !== undefined ? formatRelative(latest.submittedAt).label : '—' },
              ]}
            />

            {latest === undefined ? (
              <EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Нет отправленного решения" description="Ментор ещё не загрузил файл по этой версии." />
            ) : (
              <div>
                <SectionLabel>Решение на проверке</SectionLabel>
                <SubmissionVersionCard submission={latest} isCurrent commentLabel="Комментарий ментора" formatDate={formatDate} onOpenFile={handleOpenFile} />
              </div>
            )}

            {previous.length > 0 ? (
              <details className="group rounded-card border border-line bg-surface-muted p-4">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-secondary transition hover:text-ink">
                  Предыдущие версии ({previous.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {previous.map((submission) => (
                    <SubmissionVersionCard key={submission.id} submission={submission} isCurrent={false} commentLabel="Комментарий ментора" formatDate={formatDate} onOpenFile={handleOpenFile} />
                  ))}
                </div>
              </details>
            ) : null}

            {assignment.status === 'Submitted' ? (
              <Notice
                tone="info"
                icon={Hourglass}
                title="Решение ждёт проверки"
                action={<Button variant="primary" onClick={() => { onStartReview(assignment); }}>Начать проверку</Button>}
              >
                Начните проверку — ментор увидит, что работу смотрят.
              </Notice>
            ) : null}

            {assignment.status === 'InReview' ? (
              mode === 'none' ? (
                <DecisionChoice onApprove={() => { setMode('approve'); }} onRework={() => { setMode('rework'); }} />
              ) : mode === 'approve' ? (
                <ApproveForm onSubmit={(comment) => { onApprove(assignment, comment); setMode('none'); }} onCancel={() => { setMode('none'); }} />
              ) : (
                <NeedsReworkForm
                  assignment={assignment}
                  timeZoneId={scope.timeZoneId}
                  onSubmit={(comment, dueAt) => { onNeedsRework(assignment, comment, dueAt); setMode('none'); }}
                  onCancel={() => { setMode('none'); }}
                />
              )
            ) : null}
          </div>
        )}
      </Drawer>

      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(next) => { if (!next) setPreviewFile(null); }} />
      <FileDetailsModal file={detailsFile} open={detailsFile !== null} onOpenChange={(next) => { if (!next) setDetailsFile(null); }} />
    </>
  );
}
