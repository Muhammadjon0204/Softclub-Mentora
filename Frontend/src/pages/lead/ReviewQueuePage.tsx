import { ClipboardCheck, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import type { PreviewActionMenuItem } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { LEAD_STATUS_META, canStartReview, pluralizeRu, sourceLabel } from '../../features/lead/assignments/leadAssignmentPresentation';
import { useAssignmentActions } from '../../features/lead/assignments/useAssignmentActions';
import { formatCategoryDateTime, formatRelative, leadNow } from '../../features/lead/scope/leadDateFormat';
import { useActiveLeadMentors, useLeadMentorNameResolver } from '../../features/lead/scope/useScopedLeadMentors';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { useResolvedLeadAssignment, useScopedLeadAssignments } from '../../features/lead/scope/useScopedLeadAssignments';
import { useReviewActions } from '../../features/lead/reviews/useReviewActions';
import { ReviewWorkspaceDrawer } from '../../features/lead-reviews/ReviewWorkspaceDrawer';
import { DAY_MS } from '../../mocks/domain/reference';
import { LEAD_ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/leadAssignments.preview';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { useToast } from '../../shared/overlays';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/** Убирает суффикс «назад» из `formatRelative` — на этой странице длительность ожидания подписана колонкой, повторное «назад» лишнее. */
function waitingLabel(waitingSinceMs: number): string {
  return formatRelative(waitingSinceMs).label.replace('назад', '').trim();
}

interface ReviewQueueRowProps {
  assignment: LeadAssignmentRecord;
  timeZoneId: string;
  waitingSince: number;
  selected: boolean;
  onOpen: (id: string) => void;
  actionItems: PreviewActionMenuItem[];
  rowRef: (node: HTMLDivElement | null) => void;
  mentorNameOf: (mentorId: string) => string;
}

/**
 * Одна строка `/lead/review-queue` (раздел N–Q промпта Lead UI rebuild):
 * ни одной отдельной кнопки действия в строке — вся строка кликабельна и
 * открывает `ReviewWorkspaceDrawer`, three-dot меню оставлено только для
 * действий, не дублирующих клик (см. `buildActionItems` в `ReviewQueuePage`).
 * Desktop — компактная grid-строка без `<table>` (нечему вызывать
 * horizontal scroll — единственная эластичная колонка это заголовок задания,
 * остальные фиксированы и малы); mobile/tablet (`< md`) — тот же контент
 * складывается в компактную карточку вместо сжатия табличных колонок.
 */
function ReviewQueueRow({ assignment: a, timeZoneId, waitingSince, selected, onOpen, actionItems, rowRef, mentorNameOf }: ReviewQueueRowProps): JSX.Element {
  const latest = a.submissions[a.submissions.length - 1];
  const statusMeta = LEAD_STATUS_META[a.status];
  const waitingMs = Math.max(0, leadNow() - waitingSince);
  const waitingAttention = waitingMs > DAY_MS;

  const titleBlock = (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <p className="truncate text-[13.5px] font-semibold leading-5 text-ink" title={a.title}>{a.title}</p>
        {latest !== undefined ? (
          <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-secondary">
            v{latest.versionNumber}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[12px] text-ink-muted">{sourceLabel(a.source)}</span>
        {latest?.isLate === true ? (
          <span className="shrink-0 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">Сдано с опозданием</span>
        ) : null}
      </div>
    </div>
  );

  const mentorBlock = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9.5px] font-semibold text-brand">
        {initialsOf(mentorNameOf(a.mentorId))}
      </span>
      <span className="truncate text-[12.5px] font-medium text-ink-secondary">{mentorNameOf(a.mentorId)}</span>
    </div>
  );

  const submittedBlock = (
    <span className="whitespace-nowrap text-[12px] text-ink-secondary" title={latest !== undefined ? formatCategoryDateTime(latest.submittedAt, timeZoneId) : undefined}>
      {latest !== undefined ? formatRelative(latest.submittedAt).label : '—'}
    </span>
  );

  const waitingBlock = (
    <span className={`whitespace-nowrap text-[13px] font-semibold tabular-nums ${waitingAttention ? 'text-warning' : 'text-ink'}`}>
      {waitingLabel(waitingSince)}
    </span>
  );

  const statusBlock = (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={`Статус: ${LEAD_ASSIGNMENT_STATUS_LABEL[a.status]}`}>
      <span aria-hidden="true" className={`h-[6px] w-[6px] shrink-0 rounded-full ${statusMeta.dot}`} />
      <span className={`whitespace-nowrap text-[12.5px] font-medium ${statusMeta.text}`}>{LEAD_ASSIGNMENT_STATUS_LABEL[a.status]}</span>
    </span>
  );

  const actionsBlock = actionItems.length > 0 ? (
    <div className="shrink-0" onClick={(event) => { event.stopPropagation(); }}>
      <PreviewActionMenu items={actionItems} />
    </div>
  ) : null;

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={() => { onOpen(a.id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(a.id); } }}
      className={`cursor-pointer border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${selected ? 'bg-brand-soft' : 'hover:bg-surface-hover'}`}
    >
      {/* Desktop / tablet-landscape: одна grid-строка, единственная эластичная колонка — заголовок. */}
      <div className="hidden min-w-0 items-center gap-4 px-5 py-3.5 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_180px_104px_88px_144px_44px]">
        {titleBlock}
        {mentorBlock}
        {submittedBlock}
        {waitingBlock}
        {statusBlock}
        <div className="flex justify-end">{actionsBlock}</div>
      </div>

      {/* Mobile / tablet-portrait: компактная карточка вместо сжатой таблицы. */}
      <div className="flex flex-col gap-2.5 px-4 py-3.5 md:hidden">
        <div className="flex items-start justify-between gap-2">
          {titleBlock}
          {actionsBlock}
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {mentorBlock}
          <span className="text-[11px] text-ink-disabled">
            <span className="text-ink-muted">Отправлено </span>
            {submittedBlock}
          </span>
          <span className="text-[11px] text-ink-disabled">
            <span className="text-ink-muted">Ожидание </span>
            {waitingBlock}
          </span>
          {statusBlock}
        </div>
      </div>
    </div>
  );
}

/**
 * `/lead/review-queue` (ТЗ 2.2, раздел 24.4) — очередь на проверку:
 * `Submitted` (в очереди) + `InReview` (уже проверяется). Сортировка по
 * времени ожидания — самые старые сверху (раздел S промпта Lead UI rebuild);
 * отдельного SLA/priority ТЗ не определяет, поэтому такого поля нет —
 * «Ожидание» это чистое presentation-форматирование `firstSubmittedAt`/
 * `assignedAt`, не новый domain-концепт.
 *
 * Никакой `<table>`: единственная эластичная колонка — заголовок задания,
 * остальные фиксированной малой ширины, поэтому строка физически не может
 * потребовать horizontal scroll на desktop (раздел P/W промпта — акцептанс
 * `scrollWidth <= clientWidth` на 1366 и выше).
 */
export function ReviewQueuePage(): JSX.Element {
  const scope = useLeadScope();
  const toast = useToast();
  const assignments = useScopedLeadAssignments();
  const mentorNameOf = useLeadMentorNameResolver();
  const assignmentActions = useAssignmentActions();
  const reviewActions = useReviewActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [mentorFilter, setMentorFilter] = useState('all');
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const assignmentId = searchParams.get('assignmentId');
  const selected = useResolvedLeadAssignment(assignmentId);

  useEffect(() => {
    if (assignmentId !== null && selected === undefined) {
      const next = new URLSearchParams(searchParams);
      next.delete('assignmentId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, selected]);

  const rawQueue = useMemo(() => {
    const items = assignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview');
    return items.map((a) => ({ assignment: a, waitingSince: a.firstSubmittedAt ?? a.assignedAt ?? 0 }));
  }, [assignments]);

  const mentors = useActiveLeadMentors();
  const mentorOptions = [{ value: 'all', label: 'Все менторы' }, ...mentors.map((m) => ({ value: m.id, label: m.fullName }))];
  const filtersActive = search.trim().length > 0 || mentorFilter !== 'all';

  const queue = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rawQueue.filter(({ assignment: a }) => {
      if (query.length > 0) {
        const mentorName = mentorNameOf(a.mentorId).toLowerCase();
        if (!a.title.toLowerCase().includes(query) && !mentorName.includes(query)) return false;
      }
      if (mentorFilter !== 'all' && a.mentorId !== mentorFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => a.waitingSince - b.waitingSince);
  }, [rawQueue, search, mentorFilter, mentorNameOf]);

  function openRow(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('assignmentId', id);
    setSearchParams(next);
  }

  function closeDrawer(): void {
    const idToFocus = assignmentId;
    const next = new URLSearchParams(searchParams);
    next.delete('assignmentId');
    setSearchParams(next);
    window.requestAnimationFrame(() => { if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus(); });
  }

  function token(a: LeadAssignmentRecord): string {
    return a.concurrencyToken ?? '';
  }

  /** Единственный пункт меню — «Начать проверку»; «Открыть» не добавлен нарочно, он дублировал бы клик по строке (раздел P промпта). */
  function buildActionItems(a: LeadAssignmentRecord): PreviewActionMenuItem[] {
    if (!canStartReview(a)) return [];
    return [{
      label: 'Начать проверку',
      onClick: () => {
        assignmentActions.startReview(a.id, token(a))
          .then(() => { openRow(a.id); })
          .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось начать проверку'); });
      },
    }];
  }

  return (
    <div className="space-y-5">
      <PreviewPageHeader
        title="На проверке"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — решения, ожидающие вашего внимания`}
        action={
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
            <ClipboardCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            <span className="whitespace-nowrap text-[12.5px] font-medium text-ink-secondary">
              {rawQueue.length} {pluralizeRu(rawQueue.length, 'ожидает', 'ожидают', 'ожидают')} проверки
            </span>
          </div>
        }
      />

      {rawQueue.length > 0 ? (
        <Card padded={false} className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 sm:px-6">
            <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={setSearch} className="!min-w-[220px]" />
            <PreviewSelect label="Ментор" value={mentorFilter} onChange={setMentorFilter} options={mentorOptions} className="w-[190px]" />
            {filtersActive ? <PreviewResetButton onClick={() => { setSearch(''); setMentorFilter('all'); }} /> : null}
          </div>
        </Card>
      ) : null}

      <Card padded={false} className="min-w-0">
        {rawQueue.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
            title="Нет решений, ожидающих проверки"
            description="Как только ментор отправит работу, она появится здесь."
          />
        ) : queue.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            title="Ничего не найдено"
            description="Попробуйте изменить поиск или фильтр по ментору."
          />
        ) : (
          <div>
            {queue.map(({ assignment: a, waitingSince }) => (
              <ReviewQueueRow
                key={a.id}
                assignment={a}
                timeZoneId={scope.timeZoneId}
                waitingSince={waitingSince}
                selected={a.id === assignmentId}
                onOpen={openRow}
                actionItems={buildActionItems(a)}
                mentorNameOf={mentorNameOf}
                rowRef={(node) => { if (node) rowRefs.current.set(a.id, node); else rowRefs.current.delete(a.id); }}
              />
            ))}
          </div>
        )}
      </Card>

      <ReviewWorkspaceDrawer
        assignment={selected}
        assignmentId={assignmentId}
        onClose={closeDrawer}
        mentorNameOf={mentorNameOf}
        onStartReview={(a) => {
          assignmentActions.startReview(a.id, token(a))
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось начать проверку'); });
        }}
        onApprove={(a, comment) => {
          // RV1: `reviewActions.approve` resolves the LATEST submission's id from `a.submissions`
          // itself (already hydrated by `useResolvedLeadAssignment`) — see `useReviewActions.ts`.
          reviewActions.approve(a, comment)
            .then(() => { toast.success('Задание одобрено'); closeDrawer(); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось одобрить задание'); });
        }}
        onNeedsRework={(a, comment, reworkDueAtMs) => {
          reviewActions.requestRework(a, comment, reworkDueAtMs)
            .then(() => { toast.success('Задание возвращено на доработку'); closeDrawer(); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось вернуть на доработку'); });
        }}
      />
    </div>
  );
}
