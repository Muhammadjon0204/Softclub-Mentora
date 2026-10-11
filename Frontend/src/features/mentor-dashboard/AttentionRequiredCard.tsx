import { ChevronRight, Clock3, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '../../shared/ui/Card';
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

/** Сколько пунктов показывать: карточка стоит в колонке над трекером дедлайнов и не должна его вытеснять. */
const VISIBLE_ITEMS = 3;

/** «Требует внимания» — приоритизированный микс просроченных, ожидающих проверки и близких к новому дедлайну доработки заданий. */
export function AttentionRequiredCard({ items }: { items: AttentionItem[] }): JSX.Element {
  const navigate = useNavigate();
  const visible = items.slice(0, VISIBLE_ITEMS);
  const hidden = items.length - visible.length;

  return (
    <Card padded={false} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-divider px-5 py-3.5 sm:px-6">
        <h2 className="text-[15px] font-semibold leading-5 text-ink">Требует внимания</h2>
        {items.length > 0 ? <span className="text-[12px] font-medium tabular-nums text-ink-muted">{items.length}</span> : null}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-5 text-ink">Всё под контролем</p>
            <p className="text-[12px] text-ink-muted">Нет просроченных заданий и забытых доработок</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-divider">
          {visible.map((item) => {
            const Icon = REASON_ICON[item.reason];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { navigate(item.targetPath); }}
                  className="group flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
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
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => { navigate('/mentor/tasks'); }}
                className="w-full px-5 py-2.5 text-left text-[12.5px] font-medium text-brand transition-colors hover:bg-surface-hover sm:px-6"
              >
                Ещё {hidden} — открыть все задания
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}
