import { ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AuditLogEntryDto, RecentAssignmentActivityDto } from '../../api/admin/dashboard';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { buildRecentActivityFeed, relativeTimeLabel } from './dashboardFormatters';
import { TONE_DOT_CLASS } from './dashboard.types';

interface RecentBusinessActivityCardProps {
  auditEntries: AuditLogEntryDto[];
  assignmentEntries: RecentAssignmentActivityDto[];
}

/**
 * Раньше показывала сырые ключи (`refresh_rotated`, `refresh_session_created`)
 * — теперь только человекочитаемые бизнес-события через `formatDashboardActivityEvent`.
 * Выровнена по высоте с «Предстоящими дедлайнами» (`h-full`, раздел 21 полироли),
 * каждая строка — настоящая ссылка с мягким hover.
 */
export function RecentBusinessActivityCard({ auditEntries, assignmentEntries }: RecentBusinessActivityCardProps): JSX.Element {
  const feed = buildRecentActivityFeed(auditEntries, assignmentEntries, 5);

  return (
    <Card padded={false} className="flex h-full flex-col">
      <div className="border-b border-divider px-4 py-3.5">
        <h3 className="text-[14px] font-semibold leading-5 text-ink">Последняя активность</h3>
        <p className="mt-0.5 text-[12px] text-ink-muted">Последние действия и события платформы</p>
      </div>

      <div className="flex-1">
        {feed.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
            title="Пока нет записей"
            description="Действия администраторов и события платформы появятся здесь."
          />
        ) : (
          <ul className="divide-y divide-divider">
            {feed.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={entry.href}
                  className="flex items-start gap-3 px-4 py-3 no-underline transition-colors duration-150 hover:bg-surface-hover"
                >
                  <span aria-hidden="true" className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${TONE_DOT_CLASS[entry.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">
                      <span className="font-medium">{entry.actorLabel}</span> <span className="text-ink-secondary">{entry.message}</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-muted">{relativeTimeLabel(entry.at)}</p>
                  </div>
                  {entry.statusLabel !== undefined ? (
                    <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">{entry.statusLabel}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DashboardCardFooterLink to="/admin/audit">Перейти в журнал аудита</DashboardCardFooterLink>
    </Card>
  );
}
