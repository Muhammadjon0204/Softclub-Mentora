import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, PlugZap, RefreshCw, Users, XCircle } from 'lucide-react';
import { useState } from 'react';

import { CRM_QUERY_KEYS, getCrmGroups, getCrmStatus, type CrmGroupStatus } from '../../api/admin/crm';
import { CrmGroupDrawer } from '../../features/admin-crm/CrmGroupDrawer';
import { formatRange } from '../../features/admin-crm/crmPresentation';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';

const TABS: { value: CrmGroupStatus; label: string }[] = [
  { value: 'Started', label: 'Идут' },
  { value: 'Finished', label: 'Закончились' },
  { value: 'Preparing', label: 'Набор' },
];

function StatusCard(): JSX.Element {
  const status = useQuery({ queryKey: CRM_QUERY_KEYS.status, queryFn: getCrmStatus, staleTime: 60_000 });
  const data = status.data;

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-control ${data?.connected ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted'}`}>
          <PlugZap className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">Omuz CRM</h2>
            {status.isPending ? <Skeleton className="h-5 w-24" /> : data?.connected ? (
              <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Подключено</Badge>
            ) : (
              <Badge tone={data?.configured ? 'danger' : 'warning'}><XCircle className="h-3.5 w-3.5" aria-hidden="true" />{data?.configured ? 'Нет связи' : 'Не настроено'}</Badge>
            )}
          </div>
          <p className="mt-0.5 break-all text-[12.5px] text-ink-muted">{data?.baseUrl ?? '…'}</p>
          {data?.connected ? (
            <p className="mt-2 text-[13px] text-ink-secondary">
              Ключ «{data.keyName}» · ответ за {data.latencyMs} мс · филиалов: {data.branches.length} · курсов: {data.courses.length}
            </p>
          ) : data?.error ? (
            <p className="mt-2 text-[13px] text-danger">{data.error}</p>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { void status.refetch(); }} isLoading={status.isFetching}>
          Проверить
        </Button>
      </div>
      {data?.connected && data.courses.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-divider pt-4">
          {data.courses.map((c) => <Badge key={c.id} tone="neutral">{c.name}</Badge>)}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Интеграция с CRM — первый этап отчётов по журналу: видно, что CRM реально отдаёт, как
 * Mentora считает баллы по неделям и что в данных не сходится. Только чтение.
 */
export function CrmIntegrationPage(): JSX.Element {
  const [tab, setTab] = useState<CrmGroupStatus>('Started');
  const [groupId, setGroupId] = useState<number | null>(null);
  const groups = useQuery({ queryKey: CRM_QUERY_KEYS.groups(tab), queryFn: () => getCrmGroups(tab), staleTime: 60_000 });

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Интеграция с CRM" subtitle="Группы, студенты и журнал из Omuz CRM — основа отчётов по группам" />
      <StatusCard />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-1 border-b border-divider px-4 pt-3 sm:px-5" role="tablist" aria-label="Статус групп">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => { setTab(t.value); }}
              className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium transition ${tab === t.value ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {groups.isPending ? (
          <div className="space-y-2 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : groups.isError ? (
          <div className="p-5"><ErrorState error={groups.error} onRetry={() => { void groups.refetch(); }} /></div>
        ) : groups.data.length === 0 ? (
          <div className="p-5"><EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="Групп нет" description="В CRM нет групп с таким статусом." /></div>
        ) : (
          <ul className="divide-y divide-divider">
            {groups.data.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => { setGroupId(g.id); }}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-ink">{g.name}</span>
                      <Badge tone="brand">{g.course.name}</Badge>
                      {g.biWeekly ? <Badge tone="info">детская · 2 недели</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {g.branch.name} · {formatRange(g.startsOn, g.finishesOn)} · студентов {g.enrolledStudents}
                      {g.requiredStudents > 0 ? ` из ${String(g.requiredStudents)}` : ''}
                    </p>
                    <p className={`mt-0.5 text-[12.5px] ${g.currentMentors.length > 0 ? 'text-ink-secondary' : 'text-warning'}`}>
                      {g.currentMentors.length > 0 ? g.currentMentors.join(', ') : 'нет ментора в CRM'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CrmGroupDrawer groupId={groupId} onClose={() => { setGroupId(null); }} />
    </div>
  );
}
