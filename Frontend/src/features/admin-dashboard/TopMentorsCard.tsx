import { UserRound } from 'lucide-react';

import type { TopMentorRow } from '../../api/admin/dashboard';
import { EmptyState } from '../../shared/ui/EmptyState';
import { DashboardCardFooterLink } from './DashboardCardFooterLink';
import { DashboardRankingRow } from './DashboardRankingRow';
import { InsightCard } from './InsightCard';
import { UserAvatar } from '../avatars/UserAvatar';

interface TopMentorsCardProps {
  mentors: TopMentorRow[];
}

/**
 * Ранжирование по количеству одобренных заданий — единственная, явно
 * названная в subtitle метрика (раздел 18 полироли). Progress line
 * нормализуется относительно лидера (leader = 100% ширины) — это визуальное
 * сравнение, не официальный процент эффективности ментора.
 */
export function TopMentorsCard({ mentors }: TopMentorsCardProps): JSX.Element {
  const maxApproved = Math.max(1, ...mentors.map((m) => m.approved));

  return (
    <InsightCard
      title="Топ 5 менторов"
      subtitle="По количеству одобренных заданий"
      footer={<DashboardCardFooterLink to="/admin/users">Перейти к пользователям</DashboardCardFooterLink>}
    >
      {mentors.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
            title="Недостаточно данных"
            description="Недостаточно данных для рейтинга менторов."
          />
        </div>
      ) : (
        <ul>
          {mentors.map((mentor, index) => {
            const href = `/admin/users?userId=${encodeURIComponent(mentor.mentorId)}&q=${encodeURIComponent(mentor.mentorName)}`;
            return (
              <li key={mentor.mentorId}>
                <DashboardRankingRow
                  rank={index + 1}
                  avatar={
                    <UserAvatar userId={mentor.mentorId} name={mentor.mentorName} size={null} className="h-8 w-8 text-[10.5px]" fallbackClassName="bg-brand-soft text-brand" />
                  }
                  title={mentor.mentorName}
                  subtitle={mentor.categoryName ?? undefined}
                  value={`${mentor.approved} одобрено`}
                  showLeaderLabel={false}
                  progress={(mentor.approved / maxApproved) * 100}
                  progressLabel={`${mentor.approved} одобренных заданий из максимальных ${maxApproved}`}
                  isLeader={index === 0}
                  href={href}
                  ariaLabel={`Открыть ментора ${mentor.mentorName}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </InsightCard>
  );
}
