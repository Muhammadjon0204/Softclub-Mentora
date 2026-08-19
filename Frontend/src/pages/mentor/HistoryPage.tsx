import { CheckCircle2, History as HistoryIcon, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MentorAssignmentDetailsDrawer } from '../../features/mentor-assignments/MentorAssignmentDetailsDrawer';
import { MENTOR_ASSIGNMENT_STATUS_LABEL, latestSubmission } from '../../features/mentor/assignments/mentorAssignmentPresentation';
import { formatCategoryDateTime } from '../../features/mentor/scope/mentorDateFormat';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';
import { useResolvedMentorAssignment, useScopedMentorAssignments } from '../../features/mentor/scope/useScopedMentorAssignments';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'Approved', label: 'Принятые' },
  { value: 'Cancelled', label: 'Отменённые' },
];

/**
 * `/mentor/history` — завершённые задачи (ТЗ 2.2, раздел 24.5:
 * `GET /assignments?status=Approved,Cancelled`), отдельно от рабочего
 * Kanban `/mentor/tasks`, где терминальные статусы только загромождали бы
 * активную доску.
 */
export function HistoryPage(): JSX.Element {
  const scope = useMentorScope();
  const allOwnAssignments = useScopedMentorAssignments();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const assignmentId = searchParams.get('assignmentId');
  const selected = useResolvedMentorAssignment(assignmentId);

  useEffect(() => {
    if (assignmentId !== null && selected === undefined) {
      const next = new URLSearchParams(searchParams);
      next.delete('assignmentId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, selected]);

  function openRow(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('assignmentId', id);
    setSearchParams(next);
  }

  function closeDrawer(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('assignmentId');
    setSearchParams(next);
  }

  const finished = useMemo(
    () => allOwnAssignments.filter((a) => a.status === 'Approved' || a.status === 'Cancelled').sort((a, b) => (b.approvedAt ?? b.cancelledAt ?? 0) - (a.approvedAt ?? a.cancelledAt ?? 0)),
    [allOwnAssignments],
  );

  const filtersActive = search.trim().length > 0 || statusFilter !== 'all';

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return finished.filter((a) => {
      if (query.length > 0 && !a.title.toLowerCase().includes(query)) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    });
  }, [finished, search, statusFilter]);

  return (
    <div className="space-y-5">
      <PreviewPageHeader title="История" subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — завершённые задания`} />

      {finished.length > 0 ? (
        <Card padded={false} className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 sm:px-6">
            <PreviewSearchInput placeholder="Поиск по названию" value={search} onChange={setSearch} className="!min-w-[220px]" />
            <PreviewSelect label="Статус" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} width="md" />
            {filtersActive ? <PreviewResetButton onClick={() => { setSearch(''); setStatusFilter('all'); }} /> : null}
          </div>
        </Card>
      ) : null}

      <Card padded={false} className="min-w-0">
        {finished.length === 0 ? (
          <EmptyState icon={<HistoryIcon className="h-5 w-5" aria-hidden="true" />} title="Пока нет завершённых заданий" description="Принятые и отменённые задания появятся здесь." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<HistoryIcon className="h-5 w-5" aria-hidden="true" />} title="Ничего не найдено" description="Попробуйте изменить поиск или фильтр." />
        ) : (
          <div>
            {filtered.map((a) => {
              const latest = latestSubmission(a);
              const approved = a.status === 'Approved';
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { openRow(a.id); }}
                  className="flex w-full items-center gap-3.5 border-b border-divider px-5 py-3.5 text-left transition-colors duration-150 last:border-0 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${approved ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-disabled'}`}>
                    {approved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold leading-5 text-ink" title={a.title}>{a.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                      {approved ? `Принято ${a.approvedAt !== null ? formatCategoryDateTime(a.approvedAt, scope.timeZoneId) : ''}` : (a.cancelReason ?? 'Отменено')}
                    </p>
                  </div>
                  {latest !== undefined ? (
                    <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-secondary">v{latest.versionNumber}</span>
                  ) : null}
                  <span className="shrink-0 text-[12px] font-medium text-ink-muted">{MENTOR_ASSIGNMENT_STATUS_LABEL[a.status]}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <MentorAssignmentDetailsDrawer assignment={selected} assignmentId={assignmentId} onClose={closeDrawer} />
    </div>
  );
}
