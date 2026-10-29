import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, PlugZap, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';

import { CRM_QUERY_KEYS, getCrmStatus } from '../../api/admin/crm';
import { useAuth } from '../../auth/useAuth';
import { CrmGroupsView } from '../../features/admin-crm/CrmGroupsView';
import { CrmLinksView } from '../../features/admin-crm/CrmLinksView';
import { CrmReportsView } from '../../features/admin-crm/CrmReportsView';
import { CrmSectionTabs } from '../../features/admin-crm/CrmSectionTabs';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Skeleton } from '../../shared/ui/Skeleton';

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

const SECTIONS = [
  { value: 'groups', label: 'Группы' },
  { value: 'reports', label: 'Отчёты' },
  { value: 'links', label: 'Связи с RAVAND' },
] as const;

const BRANCH_SECTIONS = SECTIONS.filter((s) => s.value !== 'links');

type Section = (typeof SECTIONS)[number]['value'];

function SectionBody({ section }: { section: Section }): JSX.Element {
  if (section === 'reports') return <CrmReportsView />;
  if (section === 'links') return <CrmLinksView />;
  return <CrmGroupsView />;
}

/**
 * Интеграция с CRM в админке. Админ организации видит всё: подключение, все группы и связи «кто есть
 * кто» между CRM и RAVAND. Админ филиала — только группы своего филиала.
 */
export function CrmIntegrationPage(): JSX.Element {
  const { user } = useAuth();
  const isOrgAdmin = user?.role === 'Admin' && user.adminScope === 'Organization';
  const [section, setSection] = useState<Section>('groups');

  if (!isOrgAdmin) {
    return (
      <div className="space-y-6">
        <PreviewPageHeader title="Группы в CRM" subtitle="Группы вашего филиала, студенты, журнал и отчёты менторов из Omuz CRM" />
        <CrmSectionTabs sections={BRANCH_SECTIONS} value={section === 'links' ? 'groups' : section} onChange={setSection} />
        <SectionBody section={section === 'links' ? 'groups' : section} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Интеграция с CRM" subtitle="Группы, студенты и журнал из Omuz CRM — основа отчётов по группам" />
      <StatusCard />
      <CrmSectionTabs sections={SECTIONS} value={section} onChange={setSection} />
      <SectionBody section={section} />
    </div>
  );
}
