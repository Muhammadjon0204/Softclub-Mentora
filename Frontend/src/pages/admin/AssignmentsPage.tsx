import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AssignmentDetailsDrawer } from '../../features/admin-assignments/AssignmentDetailsDrawer';
import { branchDisplayName as formatBranchDisplayName, enrichAssignment, formatActivity, formatDeadline, pluralizeRu } from '../../features/admin-assignments/assignmentPresentation';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { BRANCH_DIRECTORY } from '../../features/admin-preview/branchDirectory';
import {
  ASSIGNMENT_STATUS_LABEL,
  PREVIEW_ASSIGNMENTS,
  PREVIEW_ASSIGNMENT_SUMMARY,
  type PreviewAssignment,
  type PreviewAssignmentStatus,
} from '../../mocks/ui-preview/assignments.preview';
import { useAuth } from '../../auth/useAuth';
import { Select } from '../../shared/select';
import { Card } from '../../shared/ui/Card';

/**
 * UI-прототип /admin/assignments — strict enterprise / ultra minimal polish:
 * отдельная карточка «Распределение по статусам» удалена (дублировала select
 * статуса и была пустой rounded-pill панелью) — вместо неё status navigation
 * встроена в единую AssignmentWorkspaceCard и одновременно работает как фильтр.
 * Admin здесь только наблюдает (раздел 13 промпта этапа 3) — read-only, без
 * mutation store.
 */

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  ...BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName })),
];
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Все направления' },
  { value: 'C#', label: 'C#' },
  { value: 'Frontend', label: 'Frontend' },
  { value: 'Python', label: 'Python' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
  { value: 'Mobile Development', label: 'Mobile Development' },
  { value: 'QA', label: 'QA' },
  { value: 'DevOps', label: 'DevOps' },
  { value: 'Data Science', label: 'Data Science' },
];

/** «Требует доработки» слишком длинное для узкой колонки статуса — единая короткая форма на всей странице. */
const STATUS_DISPLAY_LABEL: Record<PreviewAssignmentStatus, string> = {
  ...ASSIGNMENT_STATUS_LABEL,
  NeedsRework: 'На доработке',
};

const STATUS_ORDER: PreviewAssignmentStatus[] = ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue', 'Approved'];

const STATUS_META: Record<PreviewAssignmentStatus, { dot: string; text: string }> = {
  Assigned: { dot: 'bg-ink-disabled', text: 'text-ink-secondary' },
  Submitted: { dot: 'bg-info', text: 'text-info' },
  InReview: { dot: 'bg-brand', text: 'text-brand' },
  NeedsRework: { dot: 'bg-warning', text: 'text-warning' },
  Overdue: { dot: 'bg-danger', text: 'text-danger' },
  Approved: { dot: 'bg-success', text: 'text-success' },
};

const PAGE_SIZE_OPTIONS = [12, 20, 30];

function TitleCell({ assignment }: { assignment: PreviewAssignment }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13.5px] font-semibold leading-5 text-ink" title={assignment.title}>
        {assignment.title}
      </p>
      <p className="truncate text-[12px] leading-4 text-ink-muted">{assignment.source}</p>
    </div>
  );
}

function MentorCell({ name }: { name: string }): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2" title={name}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10.5px] font-semibold text-brand">
        {initialsOf(name)}
      </span>
      <span className="truncate text-[13px] font-medium text-ink-secondary">{name}</span>
    </div>
  );
}

function ScopeCell({ branchName, categoryName, showBranch }: { branchName: string; categoryName: string; showBranch: boolean }): JSX.Element {
  if (!showBranch) {
    return <p className="truncate text-[13px] font-medium text-ink-secondary">{categoryName}</p>;
  }
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-ink">{formatBranchDisplayName(branchName)}</p>
      <p className="mt-0.5 truncate text-[12px] text-ink-muted">{categoryName}</p>
    </div>
  );
}

function StatusCell({ status }: { status: PreviewAssignmentStatus }): JSX.Element {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={`Статус: ${ASSIGNMENT_STATUS_LABEL[status]}`}>
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${meta.dot}`} />
      <span className={`whitespace-nowrap text-[13px] font-medium ${meta.text}`}>{STATUS_DISPLAY_LABEL[status]}</span>
    </span>
  );
}

function DeadlineCell({ dueLabel }: { dueLabel: string }): JSX.Element {
  const deadline = formatDeadline(dueLabel);
  return (
    <div title={dueLabel}>
      <p className="whitespace-nowrap text-[13px] tabular-nums text-ink-secondary">{deadline.primary}</p>
      {deadline.secondary !== undefined ? (
        <p className={`whitespace-nowrap text-[11.5px] tabular-nums ${deadline.overdue ? 'text-danger' : 'text-ink-muted'}`}>
          {deadline.secondary}
        </p>
      ) : null}
    </div>
  );
}

function ActivityCell({ label }: { label: string }): JSX.Element {
  return (
    <span className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-muted" title={label}>
      {formatActivity(label)}
    </span>
  );
}

function ResetFiltersButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface disabled:hover:text-ink-secondary"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Сбросить
    </button>
  );
}

interface StatusTabItem {
  value: 'all' | PreviewAssignmentStatus;
  label: string;
  count: number;
  dot?: string;
}

function StatusNavigation({
  items,
  active,
  onChange,
}: {
  items: StatusTabItem[];
  active: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto border-b border-divider" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex min-w-max items-center gap-6 px-5 sm:px-6">
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onChange(item.value);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 text-[13px] transition-colors focus-visible:outline-none ${
                isActive
                  ? 'border-brand font-semibold text-brand'
                  : 'border-transparent font-medium text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {item.dot !== undefined ? <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} /> : null}
              {item.label}
              <span className="text-xs text-ink-muted tabular-nums">{item.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function PaginationFooter({ page, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange }: PaginationProps): JSX.Element {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3.5 text-[13px] text-ink-muted sm:px-6">
      <span>
        Показано {start}–{end} из {totalCount}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
          На странице
          <Select
            ariaLabel="Заданий на странице"
            size="sm"
            value={String(pageSize)}
            onValueChange={(next) => { onPageSizeChange(Number(next)); }}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
            className="w-[68px]"
          />
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
            aria-label="Предыдущая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => {
                onPageChange(number);
              }}
              aria-current={number === page ? 'page' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-medium transition ${
                number === page ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:bg-surface-hover'
              }`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
            aria-label="Следующая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssignmentsPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const currentBranchRawName = authUser?.branch?.name ?? null;

  const scopedAssignments = useMemo(
    () => (isOrgAdmin ? PREVIEW_ASSIGNMENTS : PREVIEW_ASSIGNMENTS.filter((a) => a.branchName === currentBranchRawName)),
    [isOrgAdmin, currentBranchRawName],
  );

  // Минимальный deep-link из Dashboard (?q=<название>, из «Предстоящих дедлайнов»
  // и ленты активности) — заполняет уже существующий поиск.
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [branch, setBranch] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const assignmentId = searchParams.get('assignmentId');

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
    window.requestAnimationFrame(() => {
      if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus();
    });
  }

  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedAssignments.filter((a) => {
      if (query.length > 0 && !a.title.toLowerCase().includes(query) && !a.mentorName.toLowerCase().includes(query)) return false;
      if (isOrgAdmin && branch !== 'all' && a.branchName !== branch) return false;
      if (category !== 'all' && a.categoryName !== category) return false;
      return true;
    });
  }, [scopedAssignments, search, branch, category, isOrgAdmin]);

  const rows = useMemo(() => {
    if (status === 'all') return baseFiltered;
    return baseFiltered.filter((a) => a.status === status);
  }, [baseFiltered, status]);

  useEffect(() => {
    setPage(1);
  }, [search, branch, category, status, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = search.trim().length > 0 || branch !== 'all' || category !== 'all' || status !== 'all';

  const statusTabItems: StatusTabItem[] = useMemo(() => {
    const counts: Record<PreviewAssignmentStatus, number> = {
      Assigned: 0,
      Submitted: 0,
      InReview: 0,
      NeedsRework: 0,
      Overdue: 0,
      Approved: 0,
    };
    baseFiltered.forEach((a) => {
      counts[a.status] += 1;
    });
    return [
      { value: 'all', label: 'Все', count: baseFiltered.length },
      ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_DISPLAY_LABEL[s], count: counts[s], dot: STATUS_META[s].dot })),
    ];
  }, [baseFiltered]);

  const totalLabel = `${scopedAssignments.length} ${pluralizeRu(scopedAssignments.length, 'запись', 'записи', 'записей')}`;

  useEffect(() => {
    if (assignmentId === null) return;
    rowRefs.current.get(assignmentId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [assignmentId]);

  // Поиск ведётся только по scopedAssignments — задание чужого филиала для Branch
  // Admin неотличимо от несуществующего (тот же ErrorState в Drawer, раздел 9 ADR-001).
  const selectedRaw: PreviewAssignment | null = scopedAssignments.find((a) => a.id === assignmentId) ?? null;
  const selected = useMemo(() => (selectedRaw !== null ? enrichAssignment(selectedRaw) : undefined), [selectedRaw]);

  // Для Branch Admin фиксированные Organization-wide значения PREVIEW_ASSIGNMENT_SUMMARY
  // показывали бы чужие данные — KPI пересчитываются из уже отфильтрованного scopedAssignments.
  const summary = isOrgAdmin
    ? PREVIEW_ASSIGNMENT_SUMMARY
    : {
        active: scopedAssignments.length,
        pendingReview: scopedAssignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview').length,
        overdue: scopedAssignments.filter((a) => a.status === 'Overdue').length,
        approvedThisPeriod: scopedAssignments.filter((a) => a.status === 'Approved').length,
      };

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Задания"
        subtitle={isOrgAdmin ? 'Контроль состояния заданий по всем направлениям' : 'Контроль состояния заданий по направлениям филиала'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Активные" value={String(summary.active)} />
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} label="Ожидают проверки" value={String(summary.pendingReview)} />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          label="Просрочены"
          value={String(summary.overdue)}
          tone="warning"
        />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Завершены за период" value={String(summary.approvedThisPeriod)} />
      </div>

      <Card padded={false} className="min-w-0">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold leading-5 text-ink">Все задания</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{totalLabel}</p>
          </div>
        </div>

        <StatusNavigation items={statusTabItems} active={status} onChange={setStatus} />

        <div
          className={`flex flex-wrap items-center gap-2.5 border-b border-divider px-5 py-3.5 sm:px-6 xl:grid ${isOrgAdmin ? 'xl:grid-cols-[minmax(280px,1fr)_170px_180px_auto]' : 'xl:grid-cols-[minmax(280px,1fr)_180px_auto]'}`}
        >
          <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={setSearch} className="!min-w-[280px]" />
          {isOrgAdmin ? <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} className="w-[170px]" /> : null}
          <PreviewSelect label="Направление" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} className="w-[180px]" />
          <ResetFiltersButton
            disabled={!filtersActive}
            onClick={() => {
              setSearch('');
              setBranch('all');
              setCategory('all');
              setStatus('all');
            }}
          />
        </div>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="min-w-[180px]">Задание</PreviewTh>
            <PreviewTh className="w-[150px] xl:w-[186px]">Ментор</PreviewTh>
            <PreviewTh className="w-[150px] xl:w-[175px]">{isOrgAdmin ? 'Филиал / направление' : 'Направление'}</PreviewTh>
            <PreviewTh className="w-[130px] xl:w-[150px]">Статус</PreviewTh>
            <PreviewTh className="w-[125px] xl:w-[145px]">Дедлайн</PreviewTh>
            <PreviewTh className="hidden w-[120px] xl:table-cell" title="Последняя активность">
              Активность
            </PreviewTh>
          </PreviewTableHead>
          <tbody>
            {pageRows.map((assignment) => (
              <tr
                key={assignment.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(assignment.id, node);
                  else rowRefs.current.delete(assignment.id);
                }}
                tabIndex={0}
                onClick={() => {
                  openRow(assignment.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openRow(assignment.id);
                  }
                }}
                className={`h-[60px] cursor-pointer border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                  assignment.id === assignmentId ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                }`}
              >
                <PreviewTd>
                  <TitleCell assignment={assignment} />
                </PreviewTd>
                <PreviewTd>
                  <MentorCell name={assignment.mentorName} />
                </PreviewTd>
                <PreviewTd>
                  <ScopeCell branchName={assignment.branchName} categoryName={assignment.categoryName} showBranch={isOrgAdmin} />
                </PreviewTd>
                <PreviewTd>
                  <StatusCell status={assignment.status} />
                </PreviewTd>
                <PreviewTd>
                  <DeadlineCell dueLabel={assignment.dueLabel} />
                </PreviewTd>
                <PreviewTd className="hidden xl:table-cell">
                  <ActivityCell label={assignment.lastActivityLabel} />
                </PreviewTd>
              </tr>
            ))}
          </tbody>
        </PreviewTable>

        <PaginationFooter
          page={currentPage}
          totalPages={totalPages}
          totalCount={rows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      <AssignmentDetailsDrawer assignment={selected} assignmentId={assignmentId} onClose={closeDrawer} />
    </div>
  );
}
