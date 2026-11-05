import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProposalDto } from '../api/proposals';
import { useAuth } from '../auth/useAuth';
import { PERMISSION, usePermissions } from '../auth/usePermissions';
import { PreviewPageHeader } from '../features/admin-preview/PreviewPageHeader';
import { ProposalDecisionDialog } from '../features/proposals/ProposalDecisionDialog';
import type { ProposalDecision } from '../features/proposals/ProposalDecisionDialog';
import { ProposalDetailsDrawer } from '../features/proposals/ProposalDetailsDrawer';
import { ProposalsList } from '../features/proposals/ProposalsList';
import type { ProposalFilter } from '../features/proposals/proposalPresentation';
import { useProposalsList } from '../features/proposals/useProposals';

/**
 * Предложения менторов глазами тех, кто над ними: `/lead/proposals` и `/admin/proposals`. Решает лид
 * направления; администратор видит всё и решает только там, где лида нет (`canDecide` считает сервер).
 */
export function ProposalsReviewPage(): JSX.Element {
  const { user } = useAuth();
  const { can } = usePermissions();
  const list = useProposalsList();
  const isAdmin = user?.role === 'Admin';

  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<ProposalFilter>('Pending');
  const [decision, setDecision] = useState<{ proposal: ProposalDto; kind: ProposalDecision } | null>(null);

  const openId = searchParams.get('proposalId');
  const opened = list.items.find((item) => item.id === openId) ?? null;
  const mayDecide = can(PERMISSION.proposalsDecide);

  useEffect(() => {
    if (openId !== null && !list.isPending && opened === null) {
      const next = new URLSearchParams(searchParams);
      next.delete('proposalId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на смену id и загрузку
  }, [openId, opened, list.isPending]);

  function setOpen(id: string | null): void {
    const next = new URLSearchParams(searchParams);
    if (id === null) next.delete('proposalId');
    else next.set('proposalId', id);
    setSearchParams(next);
  }

  return (
    <div className="space-y-5">
      <PreviewPageHeader
        title="Предложения менторов"
        subtitle={isAdmin ? 'Идеи менторов и решения по ним. Решает тимлид направления' : `${user?.category?.name ?? ''} · идеи вашей команды`}
      />

      <ProposalsList
        items={list.items}
        isPending={list.isPending}
        error={list.error}
        onRetry={list.refetch}
        filter={filter}
        onFilterChange={setFilter}
        onOpen={(proposal) => { setOpen(proposal.id); }}
        showAuthor
        emptyTitle="Предложений пока нет"
        emptyDescription="Когда ментор предложит мастер-класс или дополнительные уроки, идея появится здесь."
      />

      <ProposalDetailsDrawer
        proposal={opened}
        onClose={() => { setOpen(null); }}
        assignmentHref={(id) => `/${isAdmin ? 'admin' : 'lead'}/assignments?assignmentId=${id}`}
        canEdit={false}
        onApprove={mayDecide ? (proposal) => { setDecision({ proposal, kind: 'approve' }); } : undefined}
        onReject={mayDecide ? (proposal) => { setDecision({ proposal, kind: 'reject' }); } : undefined}
        watcherNote={isAdmin ? 'Решение принимает тимлид направления.' : 'Администратор ограничил вам решения по предложениям.'}
      />

      <ProposalDecisionDialog
        proposal={decision?.proposal ?? null}
        decision={decision?.kind ?? 'approve'}
        onClose={() => { setDecision(null); }}
      />
    </div>
  );
}
