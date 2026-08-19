import { CheckCircle2, ClipboardList, Clock3, TriangleAlert, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MentorAssignmentsKanbanBoard } from '../../features/mentor-assignments/MentorAssignmentsKanbanBoard';
import { MentorAssignmentDetailsDrawer } from '../../features/mentor-assignments/MentorAssignmentDetailsDrawer';
import { useMentorScope } from '../../features/mentor/scope/useMentorScope';
import { useResolvedMentorAssignment, useScopedMentorAssignments } from '../../features/mentor/scope/useScopedMentorAssignments';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewSearchInput } from '../../features/admin-preview/PreviewToolbar';
import { Card } from '../../shared/ui/Card';

interface KpiItem {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: 'warning';
}

const KPI_TONE: Record<'default' | 'warning', string> = {
  default: 'bg-brand-soft text-brand',
  warning: 'bg-warning-soft text-warning',
};

/** Компактная однострочная сводка вместо грид из отдельных KPI-карточек — не съедать половину viewport. */
function AssignmentsKpiStrip({ items }: { items: KpiItem[] }): JSX.Element {
  return (
    <Card padded={false} className="flex flex-wrap divide-x divide-divider overflow-hidden">
      {items.map((item, index) => (
        <div key={index} className="flex min-w-[150px] flex-1 items-center gap-2.5 px-4 py-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${KPI_TONE[item.tone ?? 'default']}`}>
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11.5px] leading-4 text-ink-muted">{item.label}</p>
            <p className="text-[17px] font-bold leading-5 tabular-nums text-ink">{item.value}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}

/**
 * `/mentor/tasks` — единственная рабочая страница заданий Mentor
 * (ТЗ 2.2, раздел 24.5). Kanban-first, без таблицы по умолчанию. Mentor не
 * создаёт, не назначает и не отменяет задания — единственное действие
 * (отправка решения) выполняется внутри `MentorAssignmentDetailsDrawer`, а
 * не с этой страницы, поэтому здесь нет ни одной кнопки создания/действия.
 */
export function AssignmentsPage(): JSX.Element {
  const scope = useMentorScope();
  const allOwnAssignments = useScopedMentorAssignments();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');

  const assignmentId = searchParams.get('assignmentId');
  const selected = useResolvedMentorAssignment(assignmentId);

  // Невалидный/чужой assignmentId в URL — тихо убираем параметр, без раскрытия деталей.
  useEffect(() => {
    if (assignmentId !== null && selected === undefined) {
      const next = new URLSearchParams(searchParams);
      next.delete('assignmentId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на смену assignmentId/selected
  }, [assignmentId, selected]);

  function openRow(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('assignmentId', id);
    setSearchParams(next);
  }

  function closeDrawer(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('assignmentId');
    setSearchParams(next);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return allOwnAssignments;
    return allOwnAssignments.filter((a) => a.title.toLowerCase().includes(query));
  }, [allOwnAssignments, search]);

  const kpis = useMemo(() => ({
    active: allOwnAssignments.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status)).length,
    awaitingReview: allOwnAssignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview').length,
    rework: allOwnAssignments.filter((a) => a.status === 'NeedsRework').length,
    overdue: allOwnAssignments.filter((a) => a.status === 'Overdue').length,
    approved: allOwnAssignments.filter((a) => a.status === 'Approved').length,
  }), [allOwnAssignments]);

  return (
    <div className="space-y-5">
      <PreviewPageHeader title="Мои задания" subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — назначенные вам задания и их текущий статус`} />

      <AssignmentsKpiStrip
        items={[
          { icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />, label: 'Активные', value: kpis.active },
          { icon: <Clock3 className="h-4 w-4" aria-hidden="true" />, label: 'На проверке', value: kpis.awaitingReview },
          { icon: <Wrench className="h-4 w-4" aria-hidden="true" />, label: 'На доработке', value: kpis.rework },
          { icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" />, label: 'Просрочено', value: kpis.overdue, tone: 'warning' },
          { icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />, label: 'Принято', value: kpis.approved },
        ]}
      />

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 sm:px-6">
          <PreviewSearchInput placeholder="Поиск по названию" value={search} onChange={setSearch} className="!min-w-[240px]" />
        </div>
      </Card>

      {allOwnAssignments.length === 0 ? (
        <Card className="flex flex-col items-center gap-1.5 py-14 text-center">
          <ClipboardList className="h-6 w-6 text-ink-disabled" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-ink">Пока нет назначенных заданий</p>
          <p className="max-w-sm text-[13px] text-ink-muted">Когда руководитель назначит вам новое задание, оно появится здесь.</p>
        </Card>
      ) : (
        <MentorAssignmentsKanbanBoard assignments={filtered} timeZoneId={scope.timeZoneId} selectedId={assignmentId} onOpen={openRow} />
      )}

      <MentorAssignmentDetailsDrawer assignment={selected} assignmentId={assignmentId} onClose={closeDrawer} />
    </div>
  );
}
