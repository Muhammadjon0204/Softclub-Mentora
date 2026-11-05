import { useQuery } from '@tanstack/react-query';
import { LayoutGroup, motion } from 'framer-motion';
import { CheckCircle2, ClipboardList, Clock3, Columns3, Plus, Rows3, SearchX, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listCategories } from '../../api/admin/categories';
import { listUsers } from '../../api/admin/users';
import { listAssignments } from '../../api/lead/assignments';
import type { AssignmentDto } from '../../api/lead/assignments';
import { useAuth } from '../../auth/useAuth';
import { PERMISSION, usePermissions } from '../../auth/usePermissions';
import { Button } from '../../shared/ui/Button';
import { useToast } from '../../shared/overlays';
import { AdminAssignmentDrawer } from '../../features/admin-assignments/AdminAssignmentDrawer';
import type { AdminDrawerAction } from '../../features/admin-assignments/AdminAssignmentDrawer';
import { AdminAssignmentFormDrawer } from '../../features/admin-assignments/AdminAssignmentFormDrawer';
import { AdminReassignDialog } from '../../features/admin-assignments/AdminReassignDialog';
import { useAdminAssignmentActions } from '../../features/admin-assignments/useAdminAssignmentActions';
import { useAdminReview } from '../../features/admin-assignments/useAdminReview';
import { RescheduleAssignmentDialog } from '../../features/assignment-deadline/RescheduleAssignmentDialog';
import { AssignmentCancelDialog } from '../../features/lead-assignments/AssignmentCancelDialog';
import { ReviewWorkspaceDrawer } from '../../features/lead-reviews/ReviewWorkspaceDrawer';
import { canReassign, canReschedule } from '../../features/lead/assignments/leadAssignmentPresentation';
import { toAssignmentRecord } from '../../features/lead/assignments/assignmentAdapter';
import { useCategoryTimeZone } from '../../features/proposals/useProposals';
import { AdminAssignmentsKanban } from '../../features/admin-assignments/AdminAssignmentsKanban';
import {
  ACTIVE_STATUSES,
  ASSIGNMENT_FILTERS,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_TONE,
  AWAITING_REVIEW_STATUSES,
  assignmentSourceLabel,
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
import { AnimatedNumber, StaggerContainer } from '../../shared/ui/motion';
import { SPRING_PILL } from '../../shared/ui/motionTokens';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** Цвет счётчика и подчёркивания выбранного таба — по смыслу статуса. */
const FILTER_TONE: Record<AssignmentFilter, { text: string; bar: string }> = {
  all: { text: 'text-brand', bar: 'bg-brand' },
  open: { text: 'text-brand', bar: 'bg-brand' },
  review: { text: 'text-warning', bar: 'bg-warning' },
  rework: { text: 'text-warning', bar: 'bg-warning' },
  overdue: { text: 'text-danger', bar: 'bg-danger' },
  approved: { text: 'text-success', bar: 'bg-success' },
  cancelled: { text: 'text-ink-secondary', bar: 'bg-ink-secondary' },
};
const HINT_TONE = { muted: 'text-ink-muted', warning: 'text-warning', danger: 'text-danger' } as const;

/** Все задания контура. Своё задание администратор ведёт отсюда, чужое только смотрит. */
export function AssignmentsPage(): JSX.Element {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const organizationId = user?.organization.id ?? 'anonymous';
  const scopeKey = (domain: string, ...rest: string[]) => branchScopedKey(domain, organizationId, branchContext.selectedBranchId, ...rest);
  const { can } = usePermissions();
  const toast = useToast();
  const listKey = scopeKey('admin-assignments', 'list');
  const actions = useAdminAssignmentActions(listKey);

  const query = useQuery({ queryKey: listKey, queryFn: () => listAssignments({ page: 1, pageSize: 100, sort: 'currentDueAt', order: 'desc' }) });
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
  const view = searchParams.get('view') === 'board' ? 'board' : 'table';
  const setView = (next: 'table' | 'board'): void => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'table') params.delete('view');
      else params.set('view', next);
      return params;
    }, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [givenByMe, setGivenByMe] = useState(false);
  const [rescheduling, setRescheduling] = useState<AssignmentDto | null>(null);
  const [reassigning, setReassigning] = useState<AssignmentDto | null>(null);
  const [cancelling, setCancelling] = useState<AssignmentDto | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Открытое задание живёт в адресе: на него ведут уведомления и принятые предложения.
  const openId = searchParams.get('assignmentId');
  const setOpenId = (id: string | null): void => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (id === null) params.delete('assignmentId');
      else params.set('assignmentId', id);
      return params;
    });
  };

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
  const filtersActive = search.trim() !== '' || categoryFilter !== 'all' || branchFilter !== 'all' || filter !== 'all' || givenByMe;
  const resetFilters = (): void => { setSearch(''); setCategoryFilter('all'); setBranchFilter('all'); setFilter('all'); setGivenByMe(false); setPage(1); };

  const countFor = (statuses: string[] | null): number => (statuses === null ? assignments.length : assignments.filter((item) => statuses.includes(item.status)).length);
  const activeFilter = ASSIGNMENT_FILTERS.find((f) => f.id === filter) ?? ASSIGNMENT_FILTERS[0];
  const needle = search.trim().toLowerCase();
  const filtered = assignments.filter(
    (item) =>
      (activeFilter.statuses === null || activeFilter.statuses.includes(item.status)) &&
      (categoryFilter === 'all' || item.categoryId === categoryFilter) &&
      (branchFilter === 'all' || item.branch?.id === branchFilter) &&
      (!givenByMe || item.assignedById === user?.id) &&
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
  const myReviewCount = assignments.filter((item) => item.canManage === true && AWAITING_REVIEW_STATUSES.includes(item.status)).length;

  const review = useAdminReview(reviewingId, listKey);
  const reviewTimeZone = useCategoryTimeZone(review.assignment?.categoryId ?? rescheduling?.categoryId ?? null);

  /** Что можно сделать с открытым заданием: статус, кто выдал и что разрешил владелец. */
  const drawerActions = (item: AssignmentDto | null): AdminDrawerAction[] => {
    if (item === null) return [];
    const record = toAssignmentRecord(item);
    const owns = item.canManage === true;
    const open = !['Approved', 'Cancelled'].includes(item.status);
    const result: AdminDrawerAction[] = [];

    if (open && can(PERMISSION.assignmentsCancel)) result.push({ label: 'Отменить', onClick: () => { setCancelling(item); } });
    if (owns && canReassign(record) && !item.firstSubmittedAt && can(PERMISSION.assignmentsReassign)) {
      result.push({ label: 'Переназначить', onClick: () => { setReassigning(item); } });
    }
    if (owns && canReschedule(record) && can(PERMISSION.assignmentsReschedule)) {
      result.push({ label: 'Изменить срок', onClick: () => { setRescheduling(item); } });
    }
    if (owns && AWAITING_REVIEW_STATUSES.includes(item.status) && can(PERMISSION.assignmentsReview)) {
      result.push({ label: 'Проверить работу', primary: true, onClick: () => { setReviewingId(item.id); } });
    }

    return result;
  };

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Задания"
        subtitle="Контроль выполнения задач и соблюдения сроков по филиалам"
        action={
          can(PERMISSION.assignmentsAssign) ? (
            <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormOpen(true); }}>Новое задание</Button>
          ) : undefined
        }
      />

      <StaggerContainer className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList />} label="Активные" value={String(countFor(ACTIVE_STATUSES))} hint="Назначены и ещё не закрыты" onClick={toggle('open')} active={filter === 'open'} accent="brand" />
        <PreviewMetricCard icon={<Clock3 />} label="Ожидают проверки" value={String(reviewCount)} hint={myReviewCount > 0 ? `Ждут вашей проверки: ${String(myReviewCount)}` : 'Сданы, ждут того, кто выдал'} tone={reviewCount > 0 ? 'warning' : 'default'} onClick={toggle('review')} active={filter === 'review'} accent="warning" />
        <PreviewMetricCard icon={<TriangleAlert />} label="Просроченные" value={String(overdueCount)} hint={overdueCount > 0 ? 'Срок истёк без сдачи' : 'Просрочек нет'} tone={overdueCount > 0 ? 'danger' : 'default'} onClick={toggle('overdue')} active={filter === 'overdue'} accent="danger" />
        <PreviewMetricCard icon={<CheckCircle2 />} label="Одобрены" value={String(countFor(['Approved']))} hint="Приняты руководителем" tone="success" onClick={toggle('approved')} active={filter === 'approved'} accent="success" />
      </StaggerContainer>

      <Card padded={false} className="min-w-0">
        {/* Строгая линия табов: разделители между пунктами, у выбранного — цветная черта снизу,
            которая скользит к новому табу. Цвет — по смыслу статуса, как у карточек сверху. */}
        <LayoutGroup id="assignments-status-tabs">
          <div className="flex min-w-0 items-stretch overflow-x-auto border-b border-divider px-3 [scrollbar-width:none] sm:px-4" role="tablist" aria-label="Фильтр по статусу">
            {ASSIGNMENT_FILTERS.map((item, index) => {
              const active = item.id === filter;
              const count = countFor(item.statuses);
              const tone = FILTER_TONE[item.id];
              return (
                <div key={item.id} className="flex shrink-0 items-center">
                  {index > 0 ? <span aria-hidden="true" className="h-4 w-px bg-line" /> : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setFilter(item.id); setPage(1); }}
                    className={`relative flex h-12 items-center gap-2 px-4 text-[13px] transition-colors ${
                      active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
                    }`}
                  >
                    {item.label}
                    <AnimatedNumber value={count} className={`text-[12px] font-semibold tabular-nums transition-colors ${active ? tone.text : 'text-ink-disabled'}`} />
                    {active ? (
                      <motion.span layoutId="assignments-status-underline" aria-hidden="true" className={`absolute inset-x-3 -bottom-px h-[2px] ${tone.bar}`} transition={SPRING_PILL} />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
          <PreviewSelect label="Направление" value={categoryFilter} onChange={(value) => { setCategoryFilter(value); setPage(1); }} options={categoryOptions} width="lg" />
          {branchOptions.length > 2 ? (
            <PreviewSelect label="Филиал" value={branchFilter} onChange={(value) => { setBranchFilter(value); setPage(1); }} options={branchOptions} width="lg" />
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={givenByMe}
            onClick={() => { setGivenByMe(!givenByMe); setPage(1); }}
            className={`h-10 shrink-0 rounded-control border px-3 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${givenByMe ? 'border-brand bg-brand-soft text-brand-active' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'}`}
          >
            Выданные мной
          </button>
          <PreviewResetButton disabled={!filtersActive} onClick={resetFilters} />
          <LayoutGroup id="assignments-view">
            <div role="radiogroup" aria-label="Вид" className="ml-auto flex h-10 shrink-0 items-center rounded-control border border-line bg-surface p-1">
              {([['table', 'Таблица', Rows3], ['board', 'Канбан', Columns3]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={view === id}
                  onClick={() => { setView(id); }}
                  className={`relative isolate inline-flex h-full items-center gap-1.5 rounded-control-sm px-3 text-[12.5px] font-medium transition-colors ${view === id ? 'text-brand-active' : 'text-ink-secondary hover:text-ink'}`}
                >
                  {view === id ? <motion.span layoutId="assignments-view-pill" aria-hidden="true" className="absolute inset-0 -z-10 rounded-control-sm bg-brand-soft" transition={SPRING_PILL} /> : null}
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </LayoutGroup>
        </PreviewToolbar>

        {view === 'board' && !query.isPending && query.error === null ? (
          <AdminAssignmentsKanban
            items={filtered}
            mentorOf={mentorOf}
            categoryOf={(item) => categoryName.get(item.categoryId)}
            selectedId={openId}
            onOpen={setOpenId}
          />
        ) : (
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
                    <EmptyState icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} title="Заданий пока нет" description="Задания появятся, когда их начнут выдавать." />
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
                        <span className="block truncate text-[12px] text-ink-muted">{assignmentSourceLabel(item.source)}</span>
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
        )}

        {filtered.length > 0 && view === 'table' ? (
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
        actions={drawerActions(opened)}
      />

      <AdminAssignmentFormDrawer
        open={formOpen}
        onClose={() => { setFormOpen(false); }}
        users={usersQuery.data?.items ?? []}
        categoryName={(id) => categoryName.get(id)}
        actions={actions}
        onAssigned={setOpenId}
      />

      <RescheduleAssignmentDialog
        open={rescheduling !== null}
        onOpenChange={(next) => { if (!next) setRescheduling(null); }}
        assignmentTitle={rescheduling?.title ?? ''}
        currentDueAtMs={rescheduling !== null ? Date.parse(rescheduling.currentDueAt) : 0}
        isOverdue={rescheduling?.status === 'Overdue'}
        timeZoneId={reviewTimeZone}
        onConfirm={async (dueAtMs, reason) => {
          if (rescheduling === null) return;
          try {
            await actions.reschedule(rescheduling, dueAtMs, reason);
            toast.success('Срок изменён, исполнитель получит уведомление');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не удалось изменить срок');
            throw error;
          }
        }}
      />

      <AdminReassignDialog
        assignment={reassigning}
        users={usersQuery.data?.items ?? []}
        categoryName={reassigning !== null ? categoryName.get(reassigning.categoryId) : undefined}
        onClose={() => { setReassigning(null); }}
        onConfirm={async (assigneeId) => {
          if (reassigning === null) return;
          try {
            await actions.reassign(reassigning, assigneeId);
            toast.success('Задание переназначено');
            setReassigning(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не удалось переназначить задание');
          }
        }}
      />

      <AssignmentCancelDialog
        open={cancelling !== null}
        onOpenChange={(next) => { if (!next) setCancelling(null); }}
        title="Отменить задание"
        assignmentTitle={cancelling?.title ?? ''}
        confirmLabel="Отменить задание"
        onConfirm={(reason) => {
          if (cancelling === null) return;
          actions.cancel(cancelling, reason)
            .then(() => { toast.success('Задание отменено'); setCancelling(null); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось отменить задание'); });
        }}
      />

      <ReviewWorkspaceDrawer
        assignment={review.assignment}
        assignmentId={reviewingId}
        onClose={() => { setReviewingId(null); }}
        mentorNameOf={(id) => userName.get(id) ?? 'Исполнитель'}
        timeZoneId={reviewTimeZone}
        onStartReview={(record) => {
          const item = assignments.find((candidate) => candidate.id === record.id);
          if (item === undefined) return;
          actions.startReview(item).catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось начать проверку'); });
        }}
        onApprove={(record, comment) => {
          review.decision.approve(record, comment)
            .then(() => { toast.success('Работа принята'); setReviewingId(null); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить решение'); });
        }}
        onNeedsRework={(record, comment, dueMs) => {
          review.decision.requestRework(record, comment, dueMs)
            .then(() => { toast.success('Работа отправлена на доработку'); setReviewingId(null); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить решение'); });
        }}
      />
    </div>
  );
}
