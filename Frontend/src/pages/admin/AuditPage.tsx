import { useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';

import { apiClient } from '../../api/client';
import { auditActionLabel, auditActionTone, auditActorLabel, auditEntityLabel } from '../../features/admin-preview/auditPresentation';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';

interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: string;
  action: string;
  entityType: string;
  result: string;
}

interface AuditResult {
  items: AuditEntry[];
  totalCount: number;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function AuditResultBadge({ result }: { result: string }): JSX.Element {
  const isSuccess = result === 'Success';
  return <Badge tone={isSuccess ? 'success' : 'danger'}>{isSuccess ? 'Успешно' : result}</Badge>;
}

/** Реальный журнал административных и системных действий (`/admin/audit-log`) — не preview. */
export function AuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const query = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () =>
      (await apiClient.get<AuditResult>('/api/v1/admin/audit-log', { params: { page: 1, pageSize: 100 } })).data,
  });

  const allItems = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = allItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Журнал аудита" subtitle="Реальные административные и системные действия" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ScrollText className="h-5 w-5" />} label="Событий" value={String(query.data?.totalCount ?? 0)} />
        <PreviewMetricCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Успешные"
          value={String(allItems.filter((item) => item.result === 'Success').length)}
        />
        <PreviewMetricCard
          icon={<ShieldX className="h-5 w-5" />}
          label="Отклонённые"
          value={String(allItems.filter((item) => item.result !== 'Success').length)}
          tone="warning"
        />
      </div>

      <Card padded={false} className="min-w-0">
        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[15%]">Время</PreviewTh>
            <PreviewTh className="w-[12%]">Актор</PreviewTh>
            <PreviewTh className="w-[33%]">Действие</PreviewTh>
            <PreviewTh className="w-[20%]">Объект</PreviewTh>
            <PreviewTh className="w-[20%]">Результат</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-ink-muted sm:px-6">
                  Загрузка журнала…
                </td>
              </tr>
            ) : query.error !== null ? (
              <tr>
                <td colSpan={5} className="px-5 py-2 sm:px-6">
                  <ErrorState error={query.error} title="Не удалось загрузить журнал" onRetry={() => { void query.refetch(); }} />
                </td>
              </tr>
            ) : allItems.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
                    title="Записей пока нет"
                    description="Здесь появится история административных и системных действий."
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((item) => (
                <tr key={item.id} className="h-14 border-b border-divider text-sm transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                  <PreviewTd className="whitespace-nowrap tabular-nums">{new Date(item.occurredAt).toLocaleString('ru-RU')}</PreviewTd>
                  <PreviewTd>{auditActorLabel(item.actorType)}</PreviewTd>
                  <PreviewTd>
                    <Badge tone={auditActionTone(item.action)}>{auditActionLabel(item.action)}</Badge>
                  </PreviewTd>
                  <PreviewTd>{auditEntityLabel(item.entityType)}</PreviewTd>
                  <PreviewTd>
                    <AuditResultBadge result={item.result} />
                  </PreviewTd>
                </tr>
              ))
            )}
          </tbody>
        </PreviewTable>

        {allItems.length > 0 ? (
          <PreviewPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={allItems.length}
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
