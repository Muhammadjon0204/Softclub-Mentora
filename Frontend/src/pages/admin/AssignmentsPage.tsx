import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewDrawer } from '../../features/admin-preview/PreviewDrawer';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import {
  ASSIGNMENT_STATUS_LABEL,
  PREVIEW_ASSIGNMENTS,
  PREVIEW_ASSIGNMENT_SUMMARY,
  type PreviewAssignment,
  type PreviewAssignmentStatus,
} from '../../mocks/ui-preview/assignments.preview';
import { Card } from '../../shared/ui/Card';

/**
 * UI-прототип /admin/assignments — strict enterprise / ultra minimal polish:
 * отдельная карточка «Распределение по статусам» удалена (дублировала select
 * статуса и была пустой rounded-pill панелью) — вместо неё status navigation
 * встроена в единую AssignmentWorkspaceCard и одновременно работает как фильтр.
 */

/** Presentation-only переименование филиалов — согласовано с /admin/users и /admin/branches. */
function formatBranchDisplayName(branchName: string): string {
  switch (branchName) {
    case 'Главный офис':
      return 'Душанбе';
    case 'Филиал Худжанд':
      return 'Худжанд';
    case 'Филиал Бохтар':
      return 'Бохтар';
    default:
      return branchName;
  }
}

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «3» → «3 дня» — само число ВСЕГДА в результате, чтобы его нельзя было забыть на месте вызова. */
function formatDaysRu(n: number): string {
  return `${n} ${pluralizeRu(n, 'день', 'дня', 'дней')}`;
}

/**
 * `dueLabel` в mock-данных — уже относительная строка без реальной даты
 * («Сегодня + N дн.», «Через N дн.», «Просрочено на N дн.»), поэтому вместо
 * выдуманной календарной даты (которой у нас просто нет) формат приводится
 * к естественной русской фразе на тех же числах.
 */
function formatDeadline(dueLabel: string): { primary: string; secondary?: string; overdue: boolean } {
  const overdueMatch = /^Просрочено на (\d+) дн\.$/.exec(dueLabel);
  if (overdueMatch) {
    const n = Number(overdueMatch[1]);
    return { primary: 'Просрочено', secondary: `на ${formatDaysRu(n)}`, overdue: true };
  }
  const todayPlusMatch = /^Сегодня \+ (\d+) дн\.$/.exec(dueLabel);
  const throughMatch = /^Через (\d+) дн\.$/.exec(dueLabel);
  const raw = todayPlusMatch?.[1] ?? throughMatch?.[1];
  if (raw === undefined) return { primary: dueLabel, overdue: false };
  const n = Number(raw);
  if (n <= 0) return { primary: 'Сегодня', overdue: false };
  if (n === 1) return { primary: 'Завтра', overdue: false };
  return { primary: `Через ${formatDaysRu(n)}`, overdue: false };
}

/** «2 дн. назад» → «2 дня назад»; «Сегодня»/«Вчера» проходят как есть. */
function formatActivity(label: string): string {
  const match = /^(\d+) дн\. назад$/.exec(label);
  if (!match) return label;
  const n = Number(match[1]);
  return `${formatDaysRu(n)} назад`;
}

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
  { value: 'Главный офис', label: 'Душанбе' },
  { value: 'Филиал Худжанд', label: 'Худжанд' },
  { value: 'Филиал Бохтар', label: 'Бохтар' },
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

function ScopeCell({ branchName, categoryName }: { branchName: string; categoryName: string }): JSX.Element {
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
        <label className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
          На странице
          <select
            aria-label="Заданий на странице"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
            className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink-secondary outline-none transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
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
  // Минимальный deep-link из Dashboard (?q=<название>, из «Предстоящих дедлайнов»
  // и ленты активности) — заполняет уже существующий поиск.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [branch, setBranch] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_ASSIGNMENTS.filter((a) => {
      if (query.length > 0 && !a.title.toLowerCase().includes(query) && !a.mentorName.toLowerCase().includes(query)) return false;
      if (branch !== 'all' && a.branchName !== branch) return false;
      if (category !== 'all' && a.categoryName !== category) return false;
      return true;
    });
  }, [search, branch, category]);

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

  const totalLabel = `${PREVIEW_ASSIGNMENTS.length} ${pluralizeRu(PREVIEW_ASSIGNMENTS.length, 'запись', 'записи', 'записей')}`;

  const selected: PreviewAssignment | null = rows.find((a) => a.id === selectedId) ?? null;

  const closeDrawer = (): void => {
    const idToFocus = selectedId;
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus();
    });
  };

  const openRow = (id: string): void => {
    setSelectedId(id);
  };

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Задания" subtitle="Контроль состояния заданий по всем направлениям" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Активные" value={String(PREVIEW_ASSIGNMENT_SUMMARY.active)} />
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} label="Ожидают проверки" value={String(PREVIEW_ASSIGNMENT_SUMMARY.pendingReview)} />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          label="Просрочены"
          value={String(PREVIEW_ASSIGNMENT_SUMMARY.overdue)}
          tone="warning"
        />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Завершены за период" value={String(PREVIEW_ASSIGNMENT_SUMMARY.approvedThisPeriod)} />
      </div>

      <Card padded={false} className="min-w-0">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold leading-5 text-ink">Все задания</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{totalLabel}</p>
          </div>
        </div>

        <StatusNavigation items={statusTabItems} active={status} onChange={setStatus} />

        <div className="flex flex-wrap items-center gap-2.5 border-b border-divider px-5 py-3.5 sm:px-6 xl:grid xl:grid-cols-[minmax(280px,1fr)_170px_180px_auto]">
          <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={setSearch} className="!min-w-[280px]" />
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} className="w-[170px]" />
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
            <PreviewTh className="w-[150px] xl:w-[175px]">Филиал / направление</PreviewTh>
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
                  assignment.id === selectedId ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                }`}
              >
                <PreviewTd>
                  <TitleCell assignment={assignment} />
                </PreviewTd>
                <PreviewTd>
                  <MentorCell name={assignment.mentorName} />
                </PreviewTd>
                <PreviewTd>
                  <ScopeCell branchName={assignment.branchName} categoryName={assignment.categoryName} />
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

      <PreviewDrawer
        open={selected !== null}
        onClose={closeDrawer}
        width="detail"
        title={selected?.title ?? ''}
        description="Admin здесь только наблюдает — действий над заданием нет"
      >
        {selected !== null ? (
          <div className="space-y-5">
            <StatusCell status={selected.status} />
            <dl className="space-y-2.5">
              <DetailRow label="Ментор" value={selected.mentorName} />
              <DetailRow label="Филиал" value={formatBranchDisplayName(selected.branchName)} />
              <DetailRow label="Направление" value={selected.categoryName} />
              <DetailRow label="Дедлайн" value={formatDeadlineInline(selected.dueLabel)} />
              <DetailRow label="Источник" value={selected.source} />
              <DetailRow label="Последняя активность" value={formatActivity(selected.lastActivityLabel)} />
            </dl>

            <div className="border-t border-divider pt-4">
              <p className="mb-3 text-[13px] font-semibold text-ink">Хронология</p>
              <ol className="space-y-4">
                <TimelineStep label="Назначено" timeLabel="—" done />
                <TimelineStep label="Отправлено на проверку" timeLabel={formatActivity(selected.lastActivityLabel)} done={selected.status !== 'Assigned'} />
                <TimelineStep
                  label="На проверке у Lead"
                  timeLabel={selected.status === 'InReview' ? 'сейчас' : '—'}
                  done={selected.status === 'InReview' || selected.status === 'Approved'}
                />
                <TimelineStep label="Решение" timeLabel={selected.status === 'Approved' ? formatDeadlineInline(selected.dueLabel) : '—'} done={selected.status === 'Approved'} />
              </ol>
            </div>
          </div>
        ) : null}
      </PreviewDrawer>
    </div>
  );
}

function formatDeadlineInline(dueLabel: string): string {
  const deadline = formatDeadline(dueLabel);
  return deadline.secondary !== undefined ? `${deadline.primary} — ${deadline.secondary}` : deadline.primary;
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{value}</dd>
    </div>
  );
}

function TimelineStep({ label, timeLabel, done }: { label: string; timeLabel: string; done: boolean }): JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-brand text-white' : 'bg-surface-muted text-ink-disabled'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium ${done ? 'text-ink' : 'text-ink-muted'}`}>{label}</p>
        <p className="text-[12px] text-ink-muted">{timeLabel}</p>
      </div>
    </li>
  );
}
