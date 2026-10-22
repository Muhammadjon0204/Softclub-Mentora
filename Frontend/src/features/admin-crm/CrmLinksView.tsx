import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, GraduationCap, Sparkles } from 'lucide-react';
import { useMemo } from 'react';

import { CRM_QUERY_KEYS, getCrmAccess, getCrmLinks, linkCrmBranch, linkCrmMentor, type CrmLinks } from '../../api/admin/crm';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useToast } from '../../shared/overlays';
import { SearchSelect, type SelectOption } from '../../shared/select';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmNotConfigured } from './CrmNotConfigured';

const ROLE_LABEL: Record<string, string> = { Mentor: 'ментор', Lead: 'тимлид' };
const NONE = '';

/**
 * Сохраняет связь и сразу показывает её: перечитывание связей идёт через CRM и занимает секунду-две,
 * поэтому кэш правится заранее (`apply`) и откатывается, если сервер отказал.
 */
function useLinkMutation<T>(fn: (args: T) => Promise<void>, apply: (links: CrmLinks, args: T) => CrmLinks, success: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onMutate: async (args: T) => {
      await queryClient.cancelQueries({ queryKey: CRM_QUERY_KEYS.links });
      const previous = queryClient.getQueryData<CrmLinks>(CRM_QUERY_KEYS.links);
      if (previous) queryClient.setQueryData(CRM_QUERY_KEYS.links, apply(previous, args));
      return { previous };
    },
    onSuccess: () => { toast.success(success); },
    onError: (error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(CRM_QUERY_KEYS.links, context.previous);
      toast.error(getGenericErrorMessage(error));
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['crm'] }); },
  });
}

/** Ментор CRM — один человек: новая связь снимает старую и у ментора, и у пользователя. */
function applyMentorLink(links: CrmLinks, { crmMentorId, userId }: { crmMentorId: number; userId: string | null }): CrmLinks {
  const user = userId ? links.users.find((u) => u.id === userId) : undefined;
  return {
    ...links,
    mentors: links.mentors.map((m) => {
      if (m.crmMentorId === crmMentorId) return { ...m, linkedUserId: user?.id ?? null, linkedUserName: user?.fullName ?? null, suggestedUserId: null, suggestedUserName: null };
      if (userId && m.linkedUserId === userId) return { ...m, linkedUserId: null, linkedUserName: null };
      return m;
    }),
    users: links.users.map((u) => {
      if (u.id === userId) return { ...u, crmMentorId };
      if (u.crmMentorId === crmMentorId) return { ...u, crmMentorId: null };
      return u;
    }),
  };
}

function applyBranchLink(links: CrmLinks, { crmBranchId, branchId }: { crmBranchId: number; branchId: string | null }): CrmLinks {
  const branch = branchId ? links.mentoraBranches.find((b) => b.id === branchId) : undefined;
  return {
    ...links,
    branches: links.branches.map((b) => {
      if (b.crmBranchId === crmBranchId) return { ...b, linkedBranchId: branch?.id ?? null, linkedBranchName: branch?.name ?? null, suggestedBranchId: null };
      if (branchId && b.linkedBranchId === branchId) return { ...b, linkedBranchId: null, linkedBranchName: null };
      return b;
    }),
    mentoraBranches: links.mentoraBranches.map((b) => {
      if (b.id === branchId) return { ...b, crmBranchId };
      if (b.crmBranchId === crmBranchId) return { ...b, crmBranchId: null };
      return b;
    }),
  };
}

function BranchLinks({ data }: { data: CrmLinks }): JSX.Element {
  const mutation = useLinkMutation(
    ({ crmBranchId, branchId }: { crmBranchId: number; branchId: string | null }) => linkCrmBranch(crmBranchId, branchId),
    applyBranchLink,
    'Связь филиала сохранена',
  );
  const options: SelectOption[] = useMemo(
    () => [{ value: NONE, label: '— не связан —' }, ...data.mentoraBranches.map((b) => ({ value: b.id, label: b.name }))],
    [data.mentoraBranches],
  );

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Building2 className="h-4 w-4 text-ink-muted" aria-hidden="true" />Филиалы</h2>
      <p className="mt-1 text-[13px] text-ink-muted">Админ филиала видит группы CRM того филиала, с которым связан его филиал.</p>
      <ul className="mt-4 divide-y divide-divider">
        {data.branches.map((b) => {
          const suggested = b.suggestedBranchId ? data.mentoraBranches.find((x) => x.id === b.suggestedBranchId) : undefined;
          return (
            <li key={b.crmBranchId} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-[140px] flex-1 text-[14px] font-medium text-ink">{b.name} <span className="text-[12px] font-normal text-ink-muted">в CRM</span></span>
              {suggested ? (
                <Button size="sm" variant="secondary" leadingIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { mutation.mutate({ crmBranchId: b.crmBranchId, branchId: suggested.id }); }}>
                  Связать с «{suggested.name}»
                </Button>
              ) : null}
              <div className="w-full sm:w-64">
                <SearchSelect
                  value={b.linkedBranchId ?? NONE}
                  onValueChange={(value) => { mutation.mutate({ crmBranchId: b.crmBranchId, branchId: value === NONE ? null : value }); }}
                  options={options}
                  ariaLabel={`Филиал Mentora для «${b.name}»`}
                  size="sm"
                  disabled={mutation.isPending}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function MentorLinks({ data }: { data: CrmLinks }): JSX.Element {
  const mutation = useLinkMutation(
    ({ crmMentorId, userId }: { crmMentorId: number; userId: string | null }) => linkCrmMentor(crmMentorId, userId),
    applyMentorLink,
    'Связь ментора сохранена',
  );
  const options: SelectOption[] = useMemo(
    () => [
      { value: NONE, label: '— не связан —' },
      ...data.users.map((u) => ({
        value: u.id,
        label: u.fullName,
        description: [ROLE_LABEL[u.role] ?? u.role, u.branch, u.crmMentorId ? 'уже связан с другим' : null].filter(Boolean).join(' · '),
      })),
    ],
    [data.users],
  );
  const linked = data.mentors.filter((m) => m.linkedUserId).length;

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><GraduationCap className="h-4 w-4 text-ink-muted" aria-hidden="true" />Менторы</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Связано {linked} из {data.mentors.length}. Ментор видит свои группы из CRM, тимлид — группы менторов своей категории.
      </p>
      <ul className="mt-4 divide-y divide-divider">
        {data.mentors.map((m) => (
          <li key={m.crmMentorId} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{m.fullName}</span>
                {!m.isActive ? <Badge tone="neutral">не работает</Badge> : null}
              </div>
              <p className="text-[12px] text-ink-muted">
                {[m.branch, m.phone, m.currentGroups > 0 ? `групп сейчас: ${String(m.currentGroups)}` : 'сейчас без групп'].filter(Boolean).join(' · ')}
              </p>
            </div>
            {m.suggestedUserId && m.suggestedUserName ? (
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => { mutation.mutate({ crmMentorId: m.crmMentorId, userId: m.suggestedUserId ?? null }); }}
              >
                Это {m.suggestedUserName}?
              </Button>
            ) : null}
            <div className="w-full sm:w-72">
              <SearchSelect
                value={m.linkedUserId ?? NONE}
                onValueChange={(value) => { mutation.mutate({ crmMentorId: m.crmMentorId, userId: value === NONE ? null : value }); }}
                options={options}
                placeholder="Выберите пользователя"
                searchPlaceholder="Имя пользователя…"
                ariaLabel={`Пользователь Mentora для «${m.fullName}»`}
                size="sm"
                disabled={mutation.isPending}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Связи «кто есть кто» между CRM и Mentora. Только для админа организации: от этих связей зависит,
 * какие группы CRM видит каждый человек.
 */
export function CrmLinksView(): JSX.Element {
  const access = useQuery({ queryKey: CRM_QUERY_KEYS.access, queryFn: getCrmAccess, staleTime: 60_000 });
  const configured = access.data?.configured === true;
  const links = useQuery({ queryKey: CRM_QUERY_KEYS.links, queryFn: getCrmLinks, staleTime: 30_000, enabled: configured });

  if (access.data && !configured) {
    return <CrmNotConfigured />;
  }

  if (links.isPending) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  }
  if (links.isError) {
    return <Card><ErrorState error={links.error} onRetry={() => { void links.refetch(); }} /></Card>;
  }

  return (
    <div className="space-y-6">
      <BranchLinks data={links.data} />
      <MentorLinks data={links.data} />
    </div>
  );
}
