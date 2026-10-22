import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Link2Off, Users } from 'lucide-react';
import { useState } from 'react';

import { CRM_QUERY_KEYS, getCrmAccess, getCrmGroups, type CrmGroupStatus } from '../../api/admin/crm';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmGroupDrawer } from './CrmGroupDrawer';
import { CrmNotConfigured } from './CrmNotConfigured';
import { CrmSelfLinkCard } from './CrmSelfLinkCard';
import { formatRange } from './crmPresentation';

const TABS: { value: CrmGroupStatus; label: string }[] = [
  { value: 'Started', label: 'Идут' },
  { value: 'Finished', label: 'Закончились' },
  { value: 'Preparing', label: 'Набор' },
];

const EMPTY_TEXT: Record<string, string> = {
  Organization: 'В CRM нет групп с таким статусом.',
  Branch: 'В CRM у вашего филиала нет групп с таким статусом.',
  Team: 'У менторов вашей команды нет групп с таким статусом.',
  Own: 'У вас нет групп с таким статусом.',
};

/**
 * Группы CRM для любой роли. Что попадает в список, решает сервер: ментор видит свои группы, тимлид —
 * группы своих менторов, админ филиала — свой филиал. Пока нужной связи с CRM нет, вместо списка —
 * объяснение, кто и что должен связать.
 */
export function CrmGroupsView(): JSX.Element {
  const [tab, setTab] = useState<CrmGroupStatus>('Started');
  const [groupId, setGroupId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: CRM_QUERY_KEYS.access, queryFn: getCrmAccess, staleTime: 60_000 });
  const check = (): void => {
    void access.refetch();
    void queryClient.invalidateQueries({ queryKey: ['crm', 'groups'] });
  };
  const ready = access.data?.ready === true;
  const groups = useQuery({
    queryKey: CRM_QUERY_KEYS.groups(tab),
    queryFn: () => getCrmGroups(tab),
    staleTime: 60_000,
    enabled: ready && access.data?.configured !== false,
  });

  if (access.isPending) {
    return <Card><Skeleton className="h-24" /></Card>;
  }

  if (access.isError) {
    return <Card><ErrorState error={access.error} onRetry={() => { void access.refetch(); }} /></Card>;
  }

  if (!access.data.configured) {
    return <CrmNotConfigured />;
  }

  if (!ready && access.data.canSelfLink) {
    return <CrmSelfLinkCard access={access.data} onCheck={check} checking={access.isFetching} />;
  }

  if (!ready) {
    return (
      <Card>
        <EmptyState
          icon={<Link2Off className="h-5 w-5" aria-hidden="true" />}
          title="Нет связи с CRM"
          description={access.data.message ?? 'Аккаунт ещё не связан с CRM.'}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {access.data.canSelfLink ? <CrmSelfLinkCard access={access.data} onCheck={check} checking={access.isFetching} compact /> : null}
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
          <div className="p-5">
            <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="Групп нет" description={EMPTY_TEXT[access.data.scope] ?? EMPTY_TEXT.Organization} />
          </div>
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

        <CrmGroupDrawer groupId={groupId} onClose={() => { setGroupId(null); }} />
      </Card>
    </div>
  );
}
