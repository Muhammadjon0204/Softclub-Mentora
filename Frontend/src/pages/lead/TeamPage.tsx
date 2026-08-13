import { Clock3, Plus, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { CreateMentorDrawer } from '../../features/lead/team/CreateMentorDrawer';
import { MentorDetailsDrawer } from '../../features/lead/team/MentorDetailsDrawer';
import { useResolvedLeadMentor, useScopedLeadMentors } from '../../features/lead/scope/useScopedLeadMentors';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { useScopedLeadAssignments } from '../../features/lead/scope/useScopedLeadAssignments';
import { formatOffsetHoursAgo } from '../../features/lead/scope/leadDateFormat';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { MentorDirectoryEntry } from '../../features/lead/scope/leadWorkspace';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'Active', label: 'Активен' },
  { value: 'Invited', label: 'Приглашён' },
  { value: 'Locked', label: 'Заблокирован' },
];

const STATUS_TONE: Record<MentorDirectoryEntry['status'], 'success' | 'neutral' | 'danger'> = { Active: 'success', Invited: 'neutral', Locked: 'danger' };
const STATUS_LABEL: Record<MentorDirectoryEntry['status'], string> = { Active: 'Активен', Invited: 'Приглашён', Locked: 'Заблокирован' };

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/**
 * `/lead/team` (ТЗ 2.2, раздел 24.4 — маршрут в таблице называется «Команда»,
 * пункт меню тоже «Команда»; доменная граница остаётся Category — см. раздел
 * 11 задачи Phase 3). Показывает только Mentor своей Category, никогда
 * остальных пользователей Branch.
 */
export function TeamPage(): JSX.Element {
  const scope = useLeadScope();
  const mentors = useScopedLeadMentors();
  const assignments = useScopedLeadAssignments();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const mentorId = searchParams.get('mentorId');
  const selected = useResolvedLeadMentor(mentorId);

  useEffect(() => {
    if (mentorId !== null && selected === undefined) {
      const next = new URLSearchParams(searchParams);
      next.delete('mentorId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorId, selected]);

  function openMentor(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('mentorId', id);
    setSearchParams(next);
  }

  function closeMentor(): void {
    const idToFocus = mentorId;
    const next = new URLSearchParams(searchParams);
    next.delete('mentorId');
    setSearchParams(next);
    window.requestAnimationFrame(() => { if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus(); });
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mentors.filter((m) => {
      if (query.length > 0 && !m.fullName.toLowerCase().includes(query) && !m.email.toLowerCase().includes(query)) return false;
      if (status !== 'all' && m.status !== status) return false;
      return true;
    });
  }, [mentors, search, status]);

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Команда"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName}`}
        action={
          <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setCreateOpen(true); }}>
            Добавить ментора
          </Button>
        }
      />

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-divider px-5 py-3.5 sm:px-6">
          <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-ink-secondary">{mentors.length} менторов</span>
          <PreviewSearchInput placeholder="Поиск по имени или email" value={search} onChange={setSearch} className="!min-w-[260px]" />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-[160px]" />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />}
            title={mentors.length === 0 ? 'В направлении пока нет менторов' : 'Ничего не найдено'}
            description={mentors.length === 0 ? 'Добавьте первого ментора кнопкой выше.' : 'Попробуйте изменить фильтры.'}
          />
        ) : (
          <ul className="divide-y divide-divider">
            {rows.map((mentor) => {
              const own = assignments.filter((a) => a.mentorId === mentor.id);
              const active = own.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status)).length;
              const rework = own.filter((a) => a.status === 'NeedsRework').length;
              return (
                <li key={mentor.id}>
                  <div
                    ref={(node) => { if (node) rowRefs.current.set(mentor.id, node); else rowRefs.current.delete(mentor.id); }}
                    role="button"
                    tabIndex={0}
                    onClick={() => { openMentor(mentor.id); }}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMentor(mentor.id); } }}
                    className={`flex cursor-pointer items-center gap-3.5 px-5 py-3.5 outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6 ${mentor.id === mentorId ? 'bg-brand-soft' : ''}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12.5px] font-semibold text-brand">
                      {initialsOf(mentor.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{mentor.fullName}</p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-muted">{mentor.email}</p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-[12px] text-ink-muted lg:inline-flex">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatOffsetHoursAgo(mentor.lastActiveOffsetHours)}
                    </span>
                    {rework > 0 ? (
                      <span className="hidden shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warning sm:inline-flex">
                        {rework} на дораб.
                      </span>
                    ) : null}
                    <div className="hidden w-16 shrink-0 text-right sm:block">
                      <p className="text-[13.5px] font-semibold tabular-nums text-ink">{active}</p>
                      <p className="text-[11px] text-ink-muted">в работе</p>
                    </div>
                    <Badge tone={STATUS_TONE[mentor.status]}>{STATUS_LABEL[mentor.status]}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <MentorDetailsDrawer mentor={selected} mentorId={mentorId} onClose={closeMentor} />
      <CreateMentorDrawer open={createOpen} onClose={() => { setCreateOpen(false); }} />
    </div>
  );
}
