import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { UpcomingDeadlineDto } from '../../api/admin/dashboard';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { formatUpcomingDue } from './dashboardFormatters';
import { TONE_DOT_CLASS } from './dashboard.types';

interface UpcomingDeadlinesCardProps {
  deadlines: UpcomingDeadlineDto[];
}

/** Выровнена по высоте с «Последней активностью» (`h-full`, раздел 21 полироли), строки — настоящие ссылки. */
export function UpcomingDeadlinesCard({ deadlines }: UpcomingDeadlinesCardProps): JSX.Element {
  return (
    <Card padded={false} className="flex h-full flex-col">
      <div className="border-b border-divider px-4 py-3.5">
        <h3 className="text-[14px] font-semibold leading-5 text-ink">Предстоящие дедлайны</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">Задания с ближайшими сроками</p>
      </div>

      <div className="flex-1">
        {deadlines.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            title="Ближайших дедлайнов нет"
            description="Все текущие задания без срочных сроков."
          />
        ) : (
          <ul className="divide-y divide-divider">
            {deadlines.map((deadline) => {
              const due = formatUpcomingDue(deadline.dueAt);
              const href = `/admin/assignments?assignmentId=${encodeURIComponent(deadline.id)}&q=${encodeURIComponent(deadline.title)}`;
              return (
                <li key={deadline.id}>
                  <Link
                    to={href}
                    className="flex items-start gap-3 px-4 py-3 no-underline transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span aria-hidden="true" className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${TONE_DOT_CLASS[due.tone]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink" title={deadline.title}>
                        {deadline.title}
                      </p>
                      <p className="truncate text-[12px] text-ink-muted">{deadline.mentorName}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[12.5px] tabular-nums text-ink-secondary">{due.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DashboardCardFooterLink to="/admin/assignments">Перейти к заданиям</DashboardCardFooterLink>
    </Card>
  );
}
