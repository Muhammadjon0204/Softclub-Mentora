import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Clock3, SearchX, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listCategories } from '../../api/admin/categories';
import { listUsers } from '../../api/admin/users';
import { listAssignments } from '../../api/lead/assignments';
import type { AssignmentDto } from '../../api/lead/assignments';
import { useAuth } from '../../auth/useAuth';
import { AdminAssignmentDrawer } from '../../features/admin-assignments/AdminAssignmentDrawer';
import {
  ACTIVE_STATUSES,
  ASSIGNMENT_FILTERS,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_TONE,
  AWAITING_REVIEW_STATUSES,
  deadlineHint,
  formatShortDateTimeRu,
  parseAssignmentFilter,
} from '../../features/admin-assignments/adminAssignmentView';
import type { AssignmentFilter } from '../../features/admin-assignments/adminAssignmentView';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { branchScopedKey } from '../../features/branch-context/queryKeys';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const HINT_TONE = { muted: 'text-ink-muted', warning: 'text-warning', danger: 'text-danger' } as const;

/** Все задания филиала (или организации) — только просмотр, без действий руководителя. */
export function AssignmentsPage(): JSX.Element {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';
  const scopeKey = (domain: string, ...rest: string[]) => branchScopedKey(domain, organizationId, branchContext.selectedBranchId, ...rest);

  const query = useQuery({ queryKey: scopeKey('admin-assignments', 'list'), queryFn: () => listAssignments({ page: 1, pageSize: 100, sort: 'currentDueAt', order: 'desc' }) });
  const usersQuery = useQuery({ queryKey: ['admin-users', 'list', organizationId], queryFn: () => listUsers({ page: 1, pageSize: 100 }) });
  const categoriesQuery = useQuery({ queryKey: scopeKey('admin-categories', 'list'), queryFn: () => listCategories({ page: 1, pageSize: 100 }) });

  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseAssignmentFilter(searchParams.get('status'));
  const setFilter = (next: AssignmentFilter): void => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'all') params.delete('status');
      else params.set('status', next);
      return params;
    }, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [openId, setOpenId] = useState<string | null>(null);

  const assignments = useMemo(() => query.data?.items ?? [], [query.data]);
  const userName = useMemo(() => new Map((usersQuery.data?.items ?? []).map((u) => [u.id, u.fullName])), [usersQuery.data]);
  const categoryName = useMemo(() => new Map((categoriesQuery.data?.items ?? []).map((c) => [c.id, c.name])), [categoriesQuery.data]);
  const mentorOf = (item: AssignmentDto): string => userName.get(item.assignedToId) ?? 'Ментор';
  const showBranch = assignments.some((item) => item.branch !== null && item.branch !== undefined);
  const categoryOptions = useMemo(() => {
    const ids = [...new Set(assignments.map((item) => item.categoryId))];
    const named = ids.map((id) => ({ value: id, label: categoryName.get(id) ?? 'Направление' })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    return [{ value: 'all', label: 'Все направления' }, ...named];
  }, [assignments, categoryName]);
  const branchOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of assignments) if (item.branch) byId.set(item.branch.id, item.branch.name);
    return [{ value: 'all', label: 'Все филиалы' }, ...[...byId].map(([value, label]) => ({ value, label }))];
  }, [assignments]);
  const filtersActive = search.trim() !== '' || categoryFilter !== 'all' || branchFilter !== 'all' || filter !== 'all';
  const resetFilters = (): void => { setSearch(''); setCategoryFilter('all'); setBranchFilter('all'); setFilter('all'); setPage(1); };

  const countFor = (statuses: string[] | null): number => (statuses === null ? assignments.length : assignments.filter((item) => statuses.includes(item.status)).length);
  const activeFilter = ASSIGNMENT_FILTERS.find((f) => f.id === filter) ?? ASSIGNMENT_FILTERS[0];
  const needle = search.trim().toLowerCase();
  const filtered = assignments.filter(
    (item) =>
      (activeFilter.statuses === null || activeFilter.statuses.includes(item.status)) &&
      (categoryFilter === 'all' || item.categoryId === categoryFilter) &&
      (branchFilter === 'all' || item.branch?.id === branchFilter) &&
      (needle === '' || item.title.toLowerCase().includes(needle) || mentorOf(item).toLowerCase().includes(needle)),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const opened = assignments.find((item) => item.id === openId) ?? null;
  const now = Date.now();
  const columns = showBranch ? 5 : 4;
  const toggle = (next: AssignmentFilter) => (): void => { setFilter(filter === next ? 'all' : next); setPage(1); };
  const overdueCount = countFor(['Overdue']);
  const reviewCount = countFor(AWAITING_REVIEW_STATUSES);

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Задания" subtitle="Контроль выполнения задач и соблюдения сроков по филиалам" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList />} label="Активные" value={String(countFor(ACTIVE_STATUSES))} hint="Назначены и ещё не закрыты" onClick={toggle('open')} active={filter === 'open'} />
        <PreviewMetricCard icon={<Clock3 />} label="Ожидают проверки" value={String(reviewCount)} hint="Сданы, ждут руководителя" tone={reviewCount > 0 ? 'warning' : 'default'} onClick={toggle('review')} active={filter === 'review'} />
        <PreviewMetricCard icon={<TriangleAlert />} label="Просроченные" value={String(overdueCount)} hint={overdueCount > 0 ? 'Срок истёк без сдачи' : 'Просрочек нет'} tone={overdueCount > 0 ? 'danger' : 'default'} onClick={toggle('overdue')} active={filter === 'overdue'} />
        <PreviewMetricCard icon={<CheckCircle2 />} label="Одобрены" value={String(countFor(['Approved']))} hint="Приняты руководителем" tone="success" onClick={toggle('approved')} active={filter === 'approved'} />
      </div>

      <Card padded={false} className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-divider px-5 pb-3 pt-3.5 sm:px-6" role="tablist" aria-label="Фильтр по статусу">
            {ASSIGNMENT_FILTERS.map((item) => {
              const active = item.id === filter;
              const count = countFor(item.statuses);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setFilter(item.id); setPage(1); }}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition ${
                    active ? 'border-brand bg-brand-soft text-brand-active' : 'border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {item.label}
                  <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? 'bg-brand text-white' : 'bg-surface-muted text-ink-muted'}`}>{count}</span>
                </button>
              );
            })}
        </div>
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
          <PreviewSelect label="Направление" value={categoryFilter} onChange={(value) => { setCategoryFilter(value); setPage(1); }} options={categoryOptions} width="lg" />
          {branchOptions.length > 2 ? (
            <PreviewSelect label="Филиал" value={branchFilter} onChange={(value) => { setBranchFilter(value); setPage(1); }} options={branchOptions} width="lg" />
          ) : null}
          <PreviewResetButton disabled={!filtersActive} onClick={resetFilters} />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className={showBranch ? 'w-[30%]' : 'w-[40%]'}>Задание</PreviewTh>
            <PreviewTh className={showBranch ? 'w-[22%]' : 'w-[24%]'}>Исполнитель / Направление</PreviewTh>
            <PreviewTh className="w-[14%]">Статус</PreviewTh>
            {showBranch ? <PreviewTh className="w-[16%]">Филиал</PreviewTh> : null}
            <PreviewTh className="w-[18%]">Дедлайн</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={columns} className="py-2">
                  {Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} columns={columns} />)}
                </td>
              </tr>
            ) : query.error !== null ? (
              <tr>
                <td colSpan={columns} className="px-5 py-2 sm:px-6">
                  <ErrorState error={query.error} title="Не удалось загрузить задания" onRetry={() => { void query.refetch(); }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns}>
                  {assignments.length === 0 ? (
                    <EmptyState icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} title="Заданий пока нет" description="Задания появятся, когда руководители направлений начнут их назначать." />
                  ) : (
                    <EmptyState icon={<SearchX className="h-5 w-5" aria-hidden="true" />} title="Ничего не найдено" description="Попробуйте другой статус или запрос." />
                  )}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const tone = ASSIGNMENT_STATUS_TONE[item.status] ?? 'neutral';
                const due = formatShortDateTimeRu(item.currentDueAt);
                const hint = deadlineHint(item.status, new Date(item.currentDueAt).getTime(), now);
                const category = categoryName.get(item.categoryId);
                return (
                  <PreviewTr key={item.id} onClick={() => { setOpenId(item.id); }} selected={item.id === openId}>
                    <PreviewTd className="py-2.5">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setOpenId(item.id); }} className="block w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                        <span className="block truncate text-[13.5px] font-medium text-ink" title={item.title}>{item.title}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{item.source === 'Auto' ? 'Из расписания' : 'Индивидуальное'}</span>
                      </button>
                    </PreviewTd>
                    <PreviewTd>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={mentorOf(item)} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">{mentorOf(item)}</span>
                          <span className="block truncate text-[12px] text-ink-muted">{category ?? 'Направление'}</span>
                        </span>
                      </span>
                    </PreviewTd>
                    <PreviewTd>
                      <Badge tone={tone}>
                        <StatusDot tone={tone} />
                        {ASSIGNMENT_STATUS_LABEL[item.status] ?? item.status}
                      </Badge>
                    </PreviewTd>
                    {showBranch ? (
                      <PreviewTd className="truncate">{item.branch?.name ?? <span className="text-ink-disabled">Не привязан</span>}</PreviewTd>
                    ) : null}
                    <PreviewTd className="py-2.5">
                      <span className="block whitespace-nowrap text-[13px] tabular-nums text-ink">
                        {due.date} <span className="text-ink-muted">{due.time}</span>
                      </span>
                      {hint !== null ? <span className={`block text-[11.5px] ${HINT_TONE[hint.tone]}`}>{hint.text}</span> : null}
                    </PreviewTd>
                  </PreviewTr>
                );
              })
            )}
          </tbody>
        </PreviewTable>

        {filtered.length > 0 ? (
          <PreviewPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        ) : null}
      </Card>

      <AdminAssignmentDrawer
        assignment={opened}
        mentorName={opened !== null ? mentorOf(opened) : ''}
        categoryName={opened !== null ? (categoryName.get(opened.categoryId) ?? null) : null}
        nameOf={(id) => userName.get(id) ?? null}
        onClose={() => { setOpenId(null); }}
      />
    </div>
  );
}
