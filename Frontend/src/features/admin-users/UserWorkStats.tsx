import { CheckCircle2, ClipboardList, Clock3, Timer } from 'lucide-react';
import type { ComponentType } from 'react';

import { computeAssignmentStats, useAssignmentStats } from '../admin-assignments/useAssignmentStats';
import { AnimatedValue, StaggerContainer, StaggerItem } from '../../shared/ui/motion';
import type { PreviewUserDetails } from './userPresentation';

/**
 * Показатели работы в профиле: у ментора — его задания, у руководителя — задания его
 * направления. Плитки появляются каскадом, цифры докручиваются.
 */
export function UserWorkStats({ user }: { user: PreviewUserDetails }): JSX.Element | null {
  const { items, query } = useAssignmentStats();
  if (user.role !== 'Mentor' && user.role !== 'Lead') return null;

  const own = user.role === 'Mentor' ? items.filter((a) => a.assignedToId === user.id) : items.filter((a) => a.categoryId === user.categoryId);
  const stats = computeAssignmentStats(own);
  const tiles: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone: string }[] = [
    { icon: Timer, label: 'Сдано в срок', value: stats.onTimePct === null ? '—' : `${String(stats.onTimePct)}%`, tone: 'text-brand' },
    { icon: ClipboardList, label: 'Активные', value: String(stats.active), tone: 'text-ink-secondary' },
    { icon: Clock3, label: 'На проверке', value: String(stats.inReview), tone: stats.inReview > 0 ? 'text-warning' : 'text-ink-secondary' },
    { icon: CheckCircle2, label: 'Одобрено', value: String(stats.approved), tone: 'text-success' },
  ];

  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {user.role === 'Mentor' ? 'Работа ментора' : 'Задания направления'}
      </p>
      {query.isPending ? (
        <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[66px] animate-pulse rounded-control bg-surface-muted" />)}</div>
      ) : (
        <StaggerContainer className="grid grid-cols-2 gap-2">
          {tiles.map(({ icon: Icon, label, value, tone }) => (
            <StaggerItem key={label} className="rounded-control border border-line bg-surface px-3 py-2.5">
              <span className="flex items-center justify-between text-[11.5px] text-ink-muted">
                {label}
                <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden="true" />
              </span>
              <AnimatedValue value={value} className="mt-0.5 block text-[20px] font-semibold tabular-nums text-ink" />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </section>
  );
}
