import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProposalDto } from '../../api/proposals';
import { PERMISSION, usePermissions } from '../../auth/usePermissions';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';
import { ProposalDetailsDrawer } from '../../features/proposals/ProposalDetailsDrawer';
import { ProposalFormDrawer } from '../../features/proposals/ProposalFormDrawer';
import { ProposalsList } from '../../features/proposals/ProposalsList';
import type { ProposalFilter } from '../../features/proposals/proposalPresentation';
import { useProposalActions, useProposalsList } from '../../features/proposals/useProposals';
import { ConfirmDialog, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';

/**
 * `/mentor/proposals` — свои идеи: мастер-класс, дополнительные уроки, что угодно ещё. Принятая идея
 * становится заданием автора, дальше работает обычный цикл задания.
 */
export function ProposalsPage(): JSX.Element {
  const scope = useMentorScope();
  const toast = useToast();
  const { can } = usePermissions();
  const list = useProposalsList();
  const actions = useProposalActions();

  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProposalDto | null>(null);
  const [withdrawing, setWithdrawing] = useState<ProposalDto | null>(null);

  const openId = searchParams.get('proposalId');
  const opened = list.items.find((item) => item.id === openId) ?? null;
  const canPropose = can(PERMISSION.proposalsCreate);

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

  async function handleWithdraw(): Promise<void> {
    if (withdrawing === null) return;
    try {
      await actions.withdraw(withdrawing);
      toast.success('Предложение отозвано');
      setWithdrawing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отозвать предложение');
    }
  }

  const newProposalButton = canPropose ? (
    <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
      Новое предложение
    </Button>
  ) : undefined;

  return (
    <div className="space-y-5">
      <PreviewPageHeader title="Предложения" subtitle={`${scope.categoryName} · ваши идеи: мастер-классы, дополнительные уроки и другое`} action={newProposalButton} />

      <ProposalsList
        items={list.items}
        isPending={list.isPending}
        error={list.error}
        onRetry={list.refetch}
        filter={filter}
        onFilterChange={setFilter}
        onOpen={(proposal) => { setOpen(proposal.id); }}
        showAuthor={false}
        emptyTitle="Вы ещё ничего не предлагали"
        emptyDescription={canPropose ? 'Хотите провести мастер-класс или дополнительные уроки? Опишите идею: тимлид посмотрит её, и она станет вашим заданием.' : 'Администратор закрыл подачу новых предложений.'}
        emptyAction={newProposalButton}
      />

      <ProposalDetailsDrawer
        proposal={opened}
        onClose={() => { setOpen(null); }}
        assignmentHref={(id) => `/mentor/tasks?assignmentId=${id}`}
        canEdit={canPropose}
        onEdit={(proposal) => { setEditing(proposal); setFormOpen(true); }}
        onWithdraw={setWithdrawing}
      />

      <ProposalFormDrawer open={formOpen} onClose={() => { setFormOpen(false); }} proposal={editing} timeZoneId={scope.timeZoneId} />

      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(next) => { if (!next) setWithdrawing(null); }}
        title="Отозвать предложение"
        description={`«${withdrawing?.title ?? ''}» больше не будет на рассмотрении. Вернуть его нельзя, но можно подать заново.`}
        confirmLabel="Отозвать"
        tone="warning"
        loading={actions.isSubmitting}
        onConfirm={handleWithdraw}
      />
    </div>
  );
}
