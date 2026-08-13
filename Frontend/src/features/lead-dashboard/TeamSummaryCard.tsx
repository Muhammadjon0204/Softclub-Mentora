import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { TeamSummaryRow } from './useLeadDashboard';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

const STATUS_DOT: Record<TeamSummaryRow['status'], string> = {
  Active: 'bg-success',
  Invited: 'bg-ink-disabled',
  Locked: 'bg-danger',
};

/** Компактная сводка по менторам своей категории — без HR performance score, только рабочая загрузка (раздел 16 задачи Phase 3). */
export function TeamSummaryCard({ team }: { team: TeamSummaryRow[] }): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card padded={false} className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold leading-5 text-ink">Команда</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Менторы вашего направления</p>
        </div>
        <button
          type="button"
          onClick={() => { navigate('/lead/team'); }}
          className="shrink-0 text-[12.5px] font-medium text-brand hover:underline"
        >
          Все
        </button>
      </div>

      {team.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="В направлении пока нет менторов" description="Добавьте первого ментора на странице «Команда»." />
      ) : (
        <ul className="divide-y divide-divider">
          {team.slice(0, 6).map((mentor) => (
            <li key={mentor.mentorId} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                {initialsOf(mentor.fullName)}
                <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${STATUS_DOT[mentor.status]}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{mentor.fullName}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">Активность: {mentor.lastActiveLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {mentor.reworkCount > 0 ? (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warning">
                    {mentor.reworkCount} на дораб.
                  </span>
                ) : null}
                <div className="w-14 text-right text-[12px] leading-tight">
                  <p className="font-semibold tabular-nums text-ink">{mentor.activeCount}</p>
                  <p className="text-ink-muted">в работе</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
