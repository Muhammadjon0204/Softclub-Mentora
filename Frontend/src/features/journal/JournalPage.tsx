import { useInfiniteQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  CirclePlus,
  FilePen,
  Lock,
  RotateCcw,
  ScrollText,
  Send,
  Upload,
  UserRoundCog,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listJournal } from '../../api/journal';
import type { JournalChange, JournalEntry } from '../../api/journal';
import { dateTimeFormat } from '../../shared/i18n/intl';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { PreviewPageHeader } from '../admin-preview/PreviewPageHeader';
import {
  CHANGE_LABEL,
  JOURNAL_EVENT_LABEL,
  JOURNAL_EVENT_TONE,
  JOURNAL_FILTERS,
  dayKey,
  personRoleLabel,
} from './journalPresentation';
import type { JournalFilterKey, JournalTone } from './journalPresentation';

const PAGE_SIZE = 50;

const EVENT_ICON: Record<string, ComponentType<{ className?: string }>> = {
  DraftCreated: CirclePlus,
  SuggestedCreated: CirclePlus,
  SuggestionAccepted: Send,
  Assigned: Send,
  Reassigned: UserRoundCog,
  SubmissionUploaded: Upload,
  LateSubmissionUploaded: Upload,
  ReviewStarted: ScrollText,
  ReviewApproved: CheckCircle2,
  ReviewNeedsRework: RotateCcw,
  MarkedOverdue: AlarmClock,
  Cancelled: XCircle,
  DeadlineChanged: AlarmClock,
  DetailsEdited: FilePen,
};

const TONE_CLASS: Record<JournalTone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-muted text-ink-muted',
};

export interface JournalPageProps {
  /** У администраторов рядом есть «Журнал аудита», поэтому там заголовок уточнён. */
  title?: string;
  /** Что видит этот человек — подзаголовок страницы. */
  subtitle: string;
  /** Куда ведёт название задания: у каждой роли своя страница заданий. */
  taskHref: (assignmentId: string) => string;
  /** Ментору не нужно «→ для кого»: в его журнале это всегда он сам. */
  hideAssignee?: boolean;
}

/**
 * Журнал заданий: всё, что происходило с заданиями, которые видит человек, — кто, что и когда сделал,
 * и что было до и после. Записи берутся из истории заданий, которую приложение не может ни изменить,
 * ни удалить, поэтому журнал нельзя «подправить» задним числом.
 */
export function JournalPage({ title = 'Журнал', subtitle, taskHref, hideAssignee = false }: JournalPageProps): JSX.Element {
  const [filter, setFilter] = useState<JournalFilterKey>('all');
  const eventTypes = JOURNAL_FILTERS.find((f) => f.key === filter)?.eventTypes;

  const query = useInfiniteQuery({
    queryKey: ['journal', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listJournal({ page: pageParam, pageSize: PAGE_SIZE, eventTypes }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
  });

  const entries = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const days = useMemo(() => {
    const groups: { key: string; items: JournalEntry[] }[] = [];
    for (const entry of entries) {
      const key = dayKey(entry.occurredAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(entry);
      else groups.push({ key, items: [entry] });
    }
    return groups;
  }, [entries]);

  let body: JSX.Element;
  if (query.isPending) {
    body = (
      <div className="divide-y divide-divider">
        {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  } else if (query.isError) {
    body = <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />;
  } else if (entries.length === 0) {
    body = (
      <EmptyState
        icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
        title="Записей пока нет"
        description="Здесь появится всё, что происходит с заданиями: выдача, изменения, сдачи, проверки и просрочки."
      />
    );
  } else {
    body = (
      <div>
        {days.map((day) => (
          <section key={day.key} aria-label={formatDay(day.items[0].occurredAt)}>
            <h2 className="sticky top-0 z-[1] border-b border-divider bg-surface-muted/95 px-5 py-2 text-[12px] font-semibold text-ink-secondary backdrop-blur">
              {formatDay(day.items[0].occurredAt)}
            </h2>
            <ol className="divide-y divide-divider">
              {day.items.map((entry) => <JournalRow key={entry.id} entry={entry} taskHref={taskHref} hideAssignee={hideAssignee} />)}
            </ol>
          </section>
        ))}
        {query.hasNextPage ? (
          <div className="flex justify-center border-t border-divider p-4">
            <Button variant="secondary" isLoading={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage(); }}>
              Показать ещё
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader title={title} subtitle={subtitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Что показать">
          {JOURNAL_FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => { setFilter(f.key); }}
                className={`h-8 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Записи нельзя изменить или удалить
        </p>
      </div>

      <Card padded={false} className="overflow-hidden">{body}</Card>
    </div>
  );
}

function JournalRow({ entry, taskHref, hideAssignee }: { entry: JournalEntry; taskHref: (id: string) => string; hideAssignee: boolean }): JSX.Element {
  const Icon = EVENT_ICON[entry.eventType] ?? ScrollText;
  const tone = JOURNAL_EVENT_TONE[entry.eventType] ?? 'neutral';
  const changes = entry.changes ?? [];
  const showAssignee = !hideAssignee && entry.assignee !== undefined && entry.assignee !== null && entry.assignee.id !== entry.actor?.id;

  return (
    <li className="flex gap-3.5 px-5 py-4">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-[14px] font-semibold text-ink">
            {JOURNAL_EVENT_LABEL[entry.eventType] ?? entry.eventType}
            {entry.version !== undefined && entry.version !== null && entry.version > 1 ? (
              <span className="ml-1.5 font-normal text-ink-muted">· <span>версия</span> {String(entry.version)}</span>
            ) : null}
          </p>
          <time dateTime={entry.occurredAt} className="shrink-0 text-[12.5px] tabular-nums text-ink-muted">
            {formatTime(entry.occurredAt)}
          </time>
        </div>

        <Link to={taskHref(entry.assignmentId)} className="block truncate text-[13.5px] font-medium text-brand no-underline hover:underline">
          {entry.assignmentTitle}
        </Link>

        <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-ink-muted">
          {entry.actor ? (
            <span>
              <span className="font-medium text-ink-secondary">{entry.actor.fullName}</span> · {personRoleLabel(entry.actor)}
            </span>
          ) : (
            <span className="font-medium text-ink-secondary">Система</span>
          )}
          {showAssignee && entry.assignee ? (
            <>
              <ArrowRight className="h-3 w-3" aria-label="для" />
              <span>{entry.assignee.fullName}</span>
            </>
          ) : null}
          {entry.branchName ? <span className="text-ink-disabled">· {entry.branchName}</span> : null}
        </p>

        {changes.length > 0 ? (
          <dl className="mt-2 space-y-2 rounded-control border border-line bg-surface-muted px-3.5 py-3">
            {changes.map((change) => <ChangeRow key={change.field} change={change} />)}
          </dl>
        ) : null}

        {entry.note ? (
          <p className="mt-1 border-l-2 border-line-strong pl-3 text-[13px] leading-5 text-ink-secondary">{entry.note}</p>
        ) : null}
      </div>
    </li>
  );
}

function ChangeRow({ change }: { change: JournalChange }): JSX.Element {
  // Текст читается построчно: «было» над «стало». Короткие значения (срок, исполнитель) — в строку.
  const isLong = change.field === 'description' || change.field === 'title';
  const before = displayValue(change.field, change.before);
  const after = displayValue(change.field, change.after);

  return (
    <div className={isLong ? 'space-y-1' : 'grid grid-cols-[88px_1fr] items-baseline gap-2'}>
      <dt className="text-[12px] font-medium text-ink-muted">{CHANGE_LABEL[change.field] ?? change.field}</dt>
      <dd className={`min-w-0 text-[13px] ${isLong ? 'space-y-1' : 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5'}`}>
        <span className="sr-only">было:</span>
        <span className={`text-ink-muted line-through decoration-ink-disabled ${isLong ? 'block whitespace-pre-wrap' : ''}`}>{before ?? '—'}</span>
        {isLong ? null : <ArrowRight className="h-3 w-3 shrink-0 self-center text-ink-disabled" aria-hidden="true" />}
        <span className="sr-only">стало:</span>
        <span className={`font-medium text-ink ${isLong ? 'block whitespace-pre-wrap' : ''}`}>{after ?? '—'}</span>
      </dd>
    </div>
  );
}

function displayValue(field: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (field !== 'dueAt') return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms)
    ? value
    : dateTimeFormat({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
}

function formatTime(iso: string): string {
  return dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(Date.parse(iso));
}

function formatDay(iso: string): string {
  const key = dayKey(iso);
  const now = new Date();
  if (key === dayKey(now.toISOString())) return 'Сегодня';
  if (key === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return 'Вчера';
  return dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(Date.parse(iso));
}
