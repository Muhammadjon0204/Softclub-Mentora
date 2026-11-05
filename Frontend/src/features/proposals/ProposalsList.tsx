import { ChevronRight, Lightbulb, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { ProposalDto } from '../../api/proposals';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { formatDateTimeRu } from '../admin-assignments/adminAssignmentView';
import { PROPOSAL_FILTERS, PROPOSAL_KIND, PROPOSAL_STATUS } from './proposalPresentation';
import type { ProposalFilter } from './proposalPresentation';

export interface ProposalsListProps {
  items: ProposalDto[];
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  filter: ProposalFilter;
  onFilterChange: (filter: ProposalFilter) => void;
  onOpen: (proposal: ProposalDto) => void;
  /** Лиду и администратору важен автор, ментору — нет: все строки его. */
  showAuthor: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
}

/**
 * Список, а не сетка карточек: идей немного, и читают их по очереди сверху вниз, как почту.
 */
export function ProposalsList({
  items,
  isPending,
  error,
  onRetry,
  filter,
  onFilterChange,
  onOpen,
  showAuthor,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ProposalsListProps): JSX.Element {
  const counts = useMemo(() => {
    const byStatus = new Map<ProposalFilter, number>([['all', items.length]]);
    for (const item of items) byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
    return byStatus;
  }, [items]);

  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);

  return (
    <Card padded={false} className="min-w-0">
      <div className="flex min-w-0 items-stretch overflow-x-auto border-b border-divider px-3 [scrollbar-width:none] sm:px-4" role="tablist" aria-label="Фильтр по статусу">
        {PROPOSAL_FILTERS.map((item) => {
          const active = item.id === filter;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { onFilterChange(item.id); }}
              className={`relative flex h-12 shrink-0 items-center gap-2 px-4 text-[13px] transition-colors ${active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'}`}
            >
              {item.label}
              <span className={`text-[12px] font-semibold tabular-nums ${active ? 'text-brand' : 'text-ink-disabled'}`}>{counts.get(item.id) ?? 0}</span>
              {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-[2px] bg-brand" /> : null}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
      ) : error !== null ? (
        <div className="px-5 py-2"><ErrorState error={error} title="Не удалось загрузить предложения" onRetry={onRetry} /></div>
      ) : visible.length === 0 ? (
        items.length === 0 ? (
          <EmptyState icon={<Lightbulb className="h-5 w-5" aria-hidden="true" />} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          <EmptyState icon={<SearchX className="h-5 w-5" aria-hidden="true" />} title="Здесь пусто" description="В этом статусе предложений нет." />
        )
      ) : (
        <ul className="divide-y divide-divider">
          {visible.map((item) => {
            const { label: kindLabel, icon: KindIcon } = PROPOSAL_KIND[item.kind];
            const status = PROPOSAL_STATUS[item.status];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { onOpen(item); }}
                  className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-6"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                    <KindIcon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{item.title}</span>
                    <span className="block truncate text-[12px] text-ink-muted">
                      {showAuthor ? `${item.authorFullName} · ${item.categoryName} · ` : ''}{kindLabel} · {formatDateTimeRu(item.createdAt)}
                    </span>
                  </span>
                  {item.canDecide ? <span className="hidden text-[12px] font-medium text-warning sm:block">Ждёт вашего решения</span> : null}
                  <Badge tone={status.tone} className="max-sm:hidden">
                    <StatusDot tone={status.tone} />
                    {status.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-disabled transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
