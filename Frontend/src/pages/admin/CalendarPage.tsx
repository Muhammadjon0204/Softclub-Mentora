import { useCallback, useMemo, useState } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import { useAuth } from '../../auth/useAuth';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewResetButton, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import { DEFAULT_TIMEZONE } from '../../features/admin-branches/branchPresentation';
import { useCategoriesQuery } from '../../features/admin-categories/useCategoriesQuery';
import { useUsersQuery } from '../../features/admin-users/useUsersQuery';
import { branchScopedKey } from '../../features/branch-context/queryKeys';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { DeadlineCalendar } from '../../features/deadline-calendar/DeadlineCalendar';
import { toneOf, type CalendarEvent, type DeadlineTone } from '../../features/deadline-calendar/deadlineEvents';

const STATUS_OPTIONS: { value: string; label: string; tones: DeadlineTone[] | null }[] = [
  { value: 'all', label: 'Все статусы', tones: null },
  { value: 'open', label: 'Невыполненные', tones: ['active', 'review', 'rework', 'overdue'] },
  { value: 'overdue', label: 'Просроченные', tones: ['overdue'] },
  { value: 'active', label: 'В работе', tones: ['active'] },
  { value: 'review', label: 'На проверке', tones: ['review'] },
  { value: 'rework', label: 'На доработке', tones: ['rework'] },
  { value: 'done', label: 'Принятые', tones: ['done'] },
];

/**
 * `/admin/calendar` — дедлайны всех команд. Branch Admin видит свой филиал, Organization Admin —
 * выбранный филиал или все сразу (тот же branch-context, что у остальных разделов): сужение делает
 * сервер по `X-MTF-Branch-Id`, страница только подписывает и фильтрует события.
 */
export function CalendarPage(): JSX.Element {
  const { user } = useAuth();
  const branchContext = useBranchContext();
  const { users } = useUsersQuery();
  const { categories } = useCategoriesQuery();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const userById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const selectedBranch = branchContext.availableBranches.find((branch) => branch.id === branchContext.selectedBranchId);
  // У списка филиалов нет часового пояса; все филиалы организации живут по её поясу.
  const timeZoneId = DEFAULT_TIMEZONE;
  const showBranch = branchContext.isAllBranches;

  const toEvent = useCallback(
    (dto: AssignmentDto): CalendarEvent => {
      const tone = toneOf(dto.status);
      const mentor = userById.get(dto.assignedToId);
      const context = [categoryNameById.get(dto.categoryId) ?? mentor?.categoryName ?? null, showBranch ? (dto.branch?.name ?? mentor?.branchName ?? null) : null]
        .filter((part): part is string => part !== null && part !== '')
        .join(' · ');
      return {
        id: dto.id,
        title: dto.title,
        person: mentor?.fullName ?? 'Ментор',
        context: context === '' ? null : context,
        dueAtMs: Date.parse(dto.currentDueAt),
        tone,
        href: '/admin/assignments',
        categoryId: dto.categoryId,
      };
    },
    [userById, categoryNameById, showBranch],
  );

  const tones = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.tones ?? null;
  const filter = useCallback(
    (event: CalendarEvent): boolean =>
      (categoryFilter === 'all' || event.categoryId === categoryFilter) && (tones === null || tones.includes(event.tone)),
    [categoryFilter, tones],
  );

  const subtitle = branchContext.isAllBranches
    ? 'Дедлайны всех филиалов и команд организации'
    : `Дедлайны всех команд филиала${selectedBranch !== undefined ? ` «${selectedBranch.name}»` : branchContext.fixedBranch !== null ? ` «${branchContext.fixedBranch.name}»` : ''}`;

  const filtersActive = categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Календарь" subtitle={subtitle} />
      <DeadlineCalendar
        scopeKey={branchScopedKey('admin-calendar', user?.organization.id ?? 'anonymous', branchContext.selectedBranchId)}
        timeZoneId={timeZoneId}
        toEvent={toEvent}
        filter={filter}
        emptyUpcomingHint="Впереди дедлайнов нет ни у одной команды."
        toolbar={
          <>
            <PreviewSelect
              label="Направление"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'Все направления' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
              width="lg"
            />
            <PreviewSelect label="Статус" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} width="md" />
            <PreviewResetButton disabled={!filtersActive} onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }} />
          </>
        }
      />
    </div>
  );
}
