import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCategorySettings } from '../../api/admin/categories';
import { getGenericErrorMessage } from '../../api/problemDetails';
import {
  approveProposal,
  createProposal,
  listProposals,
  rejectProposal,
  updateProposal,
  withdrawProposal,
} from '../../api/proposals';
import type { ApproveProposalRequest, ProposalDraft, ProposalDto } from '../../api/proposals';
import { useAuth } from '../../auth/useAuth';

/** Один запрос на страницу: `PaginationLimits.MaxPageSize`, как у списков заданий. */
const MAX_PAGE_SIZE = 100;

const PROPOSALS_KEY = ['proposals'] as const;

export function useProposalsList(): { items: ProposalDto[]; isPending: boolean; error: Error | null; refetch: () => void } {
  const query = useQuery({
    queryKey: [...PROPOSALS_KEY, 'list'],
    queryFn: () => listProposals({ pageSize: MAX_PAGE_SIZE }),
  });

  return {
    items: query.data?.items ?? [],
    isPending: query.isPending,
    error: query.error,
    refetch: () => { void query.refetch(); },
  };
}

/** Счётчик в меню: сколько ждёт решения этого человека, а не сколько есть вообще. */
export function usePendingProposalCount(): number {
  const { items } = useProposalsList();
  return items.filter((p) => p.canDecide).length;
}

function rethrowReadable(error: unknown): never {
  throw new Error(getGenericErrorMessage(error));
}

export interface ProposalActions {
  create: (draft: ProposalDraft) => Promise<ProposalDto>;
  update: (id: string, draft: ProposalDraft, token: string) => Promise<ProposalDto>;
  withdraw: (proposal: ProposalDto) => Promise<ProposalDto>;
  approve: (proposal: ProposalDto, request: Omit<ApproveProposalRequest, 'concurrencyToken'>) => Promise<ProposalDto>;
  reject: (proposal: ProposalDto, comment: string) => Promise<ProposalDto>;
  isSubmitting: boolean;
}

/** Принятое предложение создаёт задание, поэтому вместе со списком обновляются и задания. */
export function useProposalActions(): ProposalActions {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: () => Promise<ProposalDto>) => action().catch(rethrowReadable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROPOSALS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['lead-assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['mentor-assignments'] });
    },
  });

  return {
    create: (draft) => mutation.mutateAsync(() => createProposal(draft)),
    update: (id, draft, token) => mutation.mutateAsync(() => updateProposal(id, draft, token)),
    withdraw: (proposal) => mutation.mutateAsync(() => withdrawProposal(proposal.id, proposal.concurrencyToken)),
    approve: (proposal, request) =>
      mutation.mutateAsync(() => approveProposal(proposal.id, { ...request, concurrencyToken: proposal.concurrencyToken })),
    reject: (proposal, comment) => mutation.mutateAsync(() => rejectProposal(proposal.id, comment, proposal.concurrencyToken)),
    isSubmitting: mutation.isPending,
  };
}

/**
 * Часовой пояс категории (`UX-001`): у лида и ментора он в профиле, администратору его отдаёт
 * настройка категории. Пока ответа нет, пояс браузера лучше пустого поля с датой.
 */
export function useCategoryTimeZone(categoryId: string | null): string {
  const { user } = useAuth();
  const own = user?.category?.id === categoryId ? user?.category?.timeZoneId : undefined;

  const query = useQuery({
    queryKey: ['category-time-zone', categoryId],
    queryFn: () => getCategorySettings(categoryId as string),
    enabled: categoryId !== null && own === undefined,
    staleTime: Infinity,
  });

  return own ?? query.data?.timeZoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
