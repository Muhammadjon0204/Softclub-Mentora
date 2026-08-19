import { ChevronRight, Clock3, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { AttentionItem, AttentionReason } from './useMentorDashboard';

const REASON_ICON: Record<AttentionReason, ComponentType<{ className?: string }>> = {
  overdue: TriangleAlert,
  'waiting-review': Clock3,
  'rework-due-soon': Wrench,
  'in-review-long': Clock3,
};

const REASON_TONE: Record<AttentionReason, string> = {
  overdue: 'text-danger bg-danger-soft',
  'waiting-review': 'text-info bg-info-soft',
  'rework-due-soon': 'text-warning bg-warning-soft',
  'in-review-long': 'text-brand bg-brand-soft',
};

/** «Требует внимания» — приоритизированный микс просроченных, ожидающих проверки и близких к новому дедлайну доработки заданий. */
export function AttentionRequiredCard({ items }: { items: AttentionItem[] }): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card padded={false} className="flex h-full min-w-0 flex-col">
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold leading-5 text-ink">Требует внимания</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Самое срочное среди ваших заданий</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="Всё под контролем"
          description="Нет просроченных заданий и забытых на доработке дедлайнов."
        />
      ) : (
        <ul className="divide-y divide-divider">
          {items.map((item) => {
            const Icon = REASON_ICON[item.reason];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { navigate(item.targetPath); }}
                  className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${REASON_TONE[item.reason]}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold leading-5 text-ink" title={item.title}>{item.title}</p>
                    <p className={`mt-0.5 truncate text-[12px] font-medium ${REASON_TONE[item.reason].split(' ')[0]}`}>{item.detailLabel}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-disabled transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-muted" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
