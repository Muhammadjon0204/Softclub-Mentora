import { AlignLeft, ArrowUpRight, CalendarDays, Check, Clock3, FileCheck2, Send, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ProposalDto } from '../../api/proposals';
import { Drawer } from '../../shared/overlays';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { MetaTiles, QuoteBlock, TextPanel } from '../../shared/ui/DetailBlocks';
import type { MetaItem } from '../../shared/ui/DetailBlocks';
import { formatDateTimeRu } from '../admin-assignments/adminAssignmentView';
import { PROPOSAL_KIND, PROPOSAL_STATUS } from './proposalPresentation';

type StepState = 'done' | 'current' | 'waiting' | 'stopped';

const STEP_CLASSES: Record<StepState, string> = {
  done: 'bg-brand text-white',
  current: 'bg-warning-soft text-warning',
  waiting: 'bg-surface-muted text-ink-disabled',
  stopped: 'bg-danger-soft text-danger',
};

/** Весь путь идеи на одной линии: автору сразу видно, на каком она шаге и что будет дальше. */
function ProposalPath({ proposal }: { proposal: ProposalDto }): JSX.Element {
  const decided = proposal.status === 'Approved' || proposal.status === 'Rejected';
  const steps: { label: string; meta: string; icon: typeof Send; state: StepState }[] = [
    { label: 'Отправлено', meta: formatDateTimeRu(proposal.createdAt), icon: Send, state: 'done' },
    {
      label: proposal.status === 'Rejected' ? 'Отклонено' : proposal.status === 'Withdrawn' ? 'Отозвано' : decided ? 'Принято' : 'Решение',
      meta: proposal.decidedAt ? formatDateTimeRu(proposal.decidedAt) : proposal.status === 'Pending' ? 'Ждёт ответа' : '—',
      icon: proposal.status === 'Pending' ? Clock3 : Check,
      state: proposal.status === 'Pending' ? 'current' : proposal.status === 'Approved' ? 'done' : 'stopped',
    },
    {
      label: 'Задание',
      meta: proposal.assignmentId !== null ? 'В работе' : 'Появится после принятия',
      icon: FileCheck2,
      state: proposal.assignmentId !== null ? 'done' : 'waiting',
    },
  ];

  return (
    <ol className="grid grid-cols-3 gap-2 rounded-control border border-line p-3">
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <li key={step.label} className="min-w-0">
            <span className={`mb-1.5 grid h-7 w-7 place-items-center rounded-full ${STEP_CLASSES[step.state]}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="truncate text-[12.5px] font-semibold text-ink">{step.label}</p>
            <p className="truncate text-[11.5px] text-ink-muted" title={step.meta}>{step.meta}</p>
          </li>
        );
      })}
    </ol>
  );
}

export interface ProposalDetailsDrawerProps {
  proposal: ProposalDto | null;
  onClose: () => void;
  /** Куда ведёт принятое предложение: страница заданий этой роли. */
  assignmentHref: (assignmentId: string) => string;
  canEdit: boolean;
  onEdit?: (proposal: ProposalDto) => void;
  onWithdraw?: (proposal: ProposalDto) => void;
  onApprove?: (proposal: ProposalDto) => void;
  onReject?: (proposal: ProposalDto) => void;
  /** Почему решения нет: лид решает сам, администратор здесь только наблюдает. */
  watcherNote?: string;
}

export function ProposalDetailsDrawer({
  proposal,
  onClose,
  assignmentHref,
  canEdit,
  onEdit,
  onWithdraw,
  onApprove,
  onReject,
  watcherNote,
}: ProposalDetailsDrawerProps): JSX.Element {
  const status = proposal !== null ? PROPOSAL_STATUS[proposal.status] : null;
  const isPending = proposal?.status === 'Pending';
  const authorCanAct = isPending && canEdit;
  const canDecide = isPending && proposal?.canDecide === true && onApprove !== undefined;

  const items: MetaItem[] = proposal !== null
    ? [
        { icon: UserRound, label: 'Автор', value: proposal.authorFullName, tone: 'brand' },
        { icon: PROPOSAL_KIND[proposal.kind].icon, label: 'Вид', value: PROPOSAL_KIND[proposal.kind].label },
        ...(proposal.preferredAt ? [{ icon: CalendarDays, label: 'Желаемая дата', value: formatDateTimeRu(proposal.preferredAt).split(',')[0] ?? '' }] : []),
      ]
    : [];

  return (
    <Drawer
      open={proposal !== null}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={proposal?.title ?? 'Предложение'}
      size="lg"
      headerActions={
        status !== null ? (
          <Badge tone={status.tone}>
            <StatusDot tone={status.tone} />
            {status.label}
          </Badge>
        ) : null
      }
      footer={
        proposal !== null && (authorCanAct || canDecide) ? (
          <div className="flex flex-wrap justify-end gap-2">
            {authorCanAct ? <Button variant="secondary" onClick={() => { onWithdraw?.(proposal); }}>Отозвать</Button> : null}
            {authorCanAct ? <Button variant="primary" onClick={() => { onEdit?.(proposal); }}>Изменить</Button> : null}
            {canDecide ? <Button variant="secondary" onClick={() => { onReject?.(proposal); }}>Отклонить</Button> : null}
            {canDecide ? <Button variant="primary" onClick={() => { onApprove?.(proposal); }}>Принять</Button> : null}
          </div>
        ) : undefined
      }
    >
      {proposal !== null ? (
        <div className="space-y-5">
          <ProposalPath proposal={proposal} />
          {proposal.decisionComment ? (
            <QuoteBlock
              label={proposal.status === 'Rejected' ? 'Причина отказа' : 'Комментарий'}
              text={proposal.decisionComment}
              meta={proposal.decidedByFullName ?? undefined}
              tone={proposal.status === 'Rejected' ? 'danger' : 'brand'}
            />
          ) : null}
          {proposal.assignmentId !== null ? (
            <Link
              to={assignmentHref(proposal.assignmentId)}
              className="flex items-center justify-between gap-3 rounded-control border border-line px-3.5 py-3 text-[13px] font-medium text-brand transition-colors hover:border-brand"
            >
              Открыть задание
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          <TextPanel icon={AlignLeft} title="Описание" text={proposal.description} emptyText="" />
          <MetaTiles items={items} />
          {isPending && !canDecide && watcherNote !== undefined ? (
            <p className="text-[12.5px] text-ink-muted">{watcherNote}</p>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
