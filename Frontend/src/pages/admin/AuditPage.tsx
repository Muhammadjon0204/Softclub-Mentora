import { useQuery } from '@tanstack/react-query';
import { ScrollText, SearchX, ShieldCheck, ShieldX } from 'lucide-react';
import { useMemo, useState } from 'react';

import { listUsers } from '../../api/admin/users';
import { apiClient } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { useCategoriesQuery } from '../../features/admin-categories/useCategoriesQuery';
import { auditActionLabel, auditActionTone, auditActorLabel, auditEntityLabel } from '../../features/admin-preview/auditPresentation';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { StaggerContainer } from '../../shared/ui/motion';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { intlLocale } from '../../shared/i18n/intl';

/** `Backend/src/MentorTaskFlow.Contracts/Admin/AuditLogDto.cs` — только поля, которые нужны странице. */
interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result: string;
  failureReason: string | null;
}

interface AuditResult {
  items: AuditEntry[];
  totalCount: number;
}

/** Одинаковые события подряд — одной строкой: последнее время, счётчик «×N» и время первого. */
interface AuditRow {
  entry: AuditEntry;
  count: number;
  firstAt: string;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const RESULT_OPTIONS = [
  { value: 'all', label: 'Все результаты' },
  { value: 'Success', label: 'Успешно' },
  { value: 'Failure', label: 'Отклонённые' },
];

function AuditResultBadge({ result, reason }: { result: string; reason: string | null }): JSX.Element {
  if (result === 'Success') return <Badge tone="success">Успешно</Badge>;
  return (
    <span title={reason ?? undefined}>
      <Badge tone="danger">{result === 'Failure' ? 'Отклонено' : result}</Badge>
    </span>
  );
}

function groupConsecutive(entries: AuditEntry[]): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const entry of entries) {
    const last = rows[rows.length - 1];
    const same =
      last !== undefined &&
      last.entry.action === entry.action &&
      last.entry.actorId === entry.actorId &&
      last.entry.entityId === entry.entityId &&
      last.entry.result === entry.result;
    if (same) {
      last.count += 1;
      last.firstAt = entry.occurredAt;
    } else {
      rows.push({ entry, count: 1, firstAt: entry.occurredAt });
    }
  }
  return rows;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  return {
    date: value.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', ''),
    time: value.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
}

/** Журнал административных и системных действий (`/admin/audit-log`). */
export function AuditPage(): JSX.Element {
  const { user } = useAuth();
  const organizationId = user?.organization.id ?? 'anonymous';
  const branchContext = useBranchContext();
  const { categories } = useCategoriesQuery();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('all');

  const query = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () =>
      (await apiClient.get<AuditResult>('/api/v1/admin/audit-log', { params: { page: 1, pageSize: 100 } })).data,
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'list', organizationId],
    queryFn: () => listUsers({ page: 1, pageSize: 100 }),
    enabled: user !== null,
  });

  const userById = useMemo(() => new Map((usersQuery.data?.items ?? []).map((u) => [u.id, u])), [usersQuery.data]);
  const nameByEntity = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    for (const branch of branchContext.availableBranches) map.set(branch.id, branch.name);
    if (branchContext.fixedBranch !== null) map.set(branchContext.fixedBranch.id, branchContext.fixedBranch.name);
    return map;
  }, [categories, branchContext.availableBranches, branchContext.fixedBranch]);

  const actorOf = (entry: AuditEntry): { name: string; email: string | null } => {
    const actor = entry.actorId !== null ? userById.get(entry.actorId) : undefined;
    return actor !== undefined ? { name: actor.fullName, email: actor.email } : { name: auditActorLabel(entry.actorType), email: null };
  };
  const objectOf = (entry: AuditEntry): { type: string; name: string | null } => {
    const id = entry.entityId;
    const name = id === null ? null : entry.entityType === 'User' ? (userById.get(id)?.fullName ?? null) : (nameByEntity.get(id) ?? null);
    return { type: auditEntityLabel(entry.entityType), name };
  };

  const allItems = useMemo(() => query.data?.items ?? [], [query.data]);
  const needle = search.trim().toLowerCase();
  const filtered = allItems.filter((entry) => {
    if (result !== 'all' && entry.result !== result) return false;
    if (needle === '') return true;
    const actor = actorOf(entry);
    const object = objectOf(entry);
    return [auditActionLabel(entry.action), entry.action, actor.name, actor.email ?? '', object.type, object.name ?? '']
      .some((part) => part.toLowerCase().includes(needle));
  });
  const rows = groupConsecutive(filtered);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = needle !== '' || result !== 'all';
  const failures = allItems.filter((item) => item.result !== 'Success').length;

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Журнал аудита" subtitle="Кто, что и когда изменил: действия администраторов, руководителей и системы" />

      <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PreviewMetricCard icon={<ScrollText />} label="Событий" value={String(query.data?.totalCount ?? 0)} hint="Всего в журнале" />
        <PreviewMetricCard
          icon={<ShieldCheck />}
          label="Успешные"
          value={String(allItems.length - failures)}
          hint="Из последних 100"
          tone="success"
          onClick={() => { setResult(result === 'Success' ? 'all' : 'Success'); setPage(1); }}
          active={result === 'Success'}
        />
        <PreviewMetricCard
          icon={<ShieldX />}
          label="Отклонённые"
          value={String(failures)}
          hint={failures > 0 ? 'Нажмите, чтобы показать' : 'Отказов нет'}
          tone={failures > 0 ? 'danger' : 'default'}
          onClick={() => { setResult(result === 'Failure' ? 'all' : 'Failure'); setPage(1); }}
          active={result === 'Failure'}
          accent="danger"
        />
      </StaggerContainer>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по действию, пользователю или объекту" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
          <PreviewSelect label="Результат" value={result} onChange={(value) => { setResult(value); setPage(1); }} options={RESULT_OPTIONS} width="md" />
          <PreviewResetButton disabled={!filtersActive} onClick={() => { setSearch(''); setResult('all'); setPage(1); }} />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[15%]">Время</PreviewTh>
            <PreviewTh className="w-[22%]">Кто</PreviewTh>
            <PreviewTh className="w-[29%]">Действие</PreviewTh>
            <PreviewTh className="w-[20%]">Объект</PreviewTh>
            <PreviewTh className="w-[14%]">Результат</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={5} className="py-2">{Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} columns={5} />)}</td>
              </tr>
            ) : query.error !== null ? (
              <tr>
                <td colSpan={5} className="px-5 py-2 sm:px-6">
                  <ErrorState error={query.error} title="Не удалось загрузить журнал" onRetry={() => { void query.refetch(); }} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  {allItems.length === 0 ? (
                    <EmptyState icon={<ScrollText className="h-5 w-5" aria-hidden="true" />} title="Записей пока нет" description="Здесь появится история административных и системных действий." />
                  ) : (
                    <EmptyState icon={<SearchX className="h-5 w-5" aria-hidden="true" />} title="Ничего не найдено" description="Попробуйте другой запрос или результат." />
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map(({ entry, count, firstAt }) => {
                const at = formatDateTime(entry.occurredAt);
                const actor = actorOf(entry);
                const object = objectOf(entry);
                return (
                  <tr key={entry.id} className="h-14 border-b border-divider text-sm transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                    <PreviewTd className="whitespace-nowrap py-2.5 tabular-nums">
                      <span className="block text-[13px] text-ink">{at.date}</span>
                      <span className="block text-[11.5px] text-ink-muted">{at.time}</span>
                    </PreviewTd>
                    <PreviewTd className="py-2.5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={actor.name} size="sm"/>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">{actor.name}</span>
                          {actor.email !== null ? <span className="block truncate text-[11.5px] text-ink-muted">{actor.email}</span> : null}
                        </span>
                      </span>
                    </PreviewTd>
                    <PreviewTd className="py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={auditActionTone(entry.action)}>{auditActionLabel(entry.action)}</Badge>
                        {count > 1 ? <span className="rounded-full bg-surface-muted px-1.5 text-[11.5px] font-semibold tabular-nums text-ink-secondary">×{count}</span> : null}
                      </span>
                      {count > 1 ? <span className="mt-0.5 block text-[11px] text-ink-muted">первое — {new Date(firstAt).toLocaleString(intlLocale(), { hour12: false })}</span> : null}
                    </PreviewTd>
                    <PreviewTd className="py-2.5">
                      <span className="block truncate text-[13px] text-ink">{object.name ?? object.type}</span>
                      {object.name !== null ? <span className="block truncate text-[11.5px] text-ink-muted">{object.type}</span> : null}
                    </PreviewTd>
                    <PreviewTd>
                      <AuditResultBadge result={entry.result} reason={entry.failureReason} />
                    </PreviewTd>
                  </tr>
                );
              })
            )}
          </tbody>
        </PreviewTable>

        {rows.length > 0 ? (
          <PreviewPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={rows.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        ) : null}
      </Card>
    </div>
  );
}
