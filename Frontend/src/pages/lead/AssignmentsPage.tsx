import { CheckCircle2, ClipboardList, Clock3, Plus, TriangleAlert, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AssignmentCancelDialog } from '../../features/lead-assignments/AssignmentCancelDialog';
import { AssignmentFormDrawer } from '../../features/lead-assignments/AssignmentFormDrawer';
import type { AssignmentFormDrawerState } from '../../features/lead-assignments/AssignmentFormDrawer';
import { AssignmentsKanbanBoard } from '../../features/lead-assignments/AssignmentsKanbanBoard';
import { LeadAssignmentDetailsDrawer } from '../../features/lead-assignments/LeadAssignmentDetailsDrawer';
import { ReassignAssignmentDialog } from '../../features/lead-assignments/ReassignAssignmentDialog';
import { assignmentCapabilities } from '../../features/lead/assignments/leadAssignmentPresentation';
import { useAssignmentActions } from '../../features/lead/assignments/useAssignmentActions';
import { useActiveLeadMentors, useLeadMentorNameResolver } from '../../features/lead/scope/useScopedLeadMentors';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { useResolvedLeadAssignment, useScopedLeadAssignments } from '../../features/lead/scope/useScopedLeadAssignments';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import type { PreviewActionMenuItem } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewSearchInput, PreviewSelect } from '../../features/admin-preview/PreviewToolbar';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

type CancelDialogState = { assignment: LeadAssignmentRecord; kind: 'cancel' | 'reject' };

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

/** Компактная однострочная сводка вместо грид из отдельных KPI-карточек — раздел C/G промпта: не съедать половину viewport. */
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
 * `/lead/assignments` (ТЗ 2.2, раздел 24.4) — центральная страница
 * Lead-раздела. Kanban — единственный workflow-view (Lead UI rebuild,
 * раздел B промпта): List/tabs/table убраны полностью, а не просто спрятаны
 * за toggle. Все действия строго по `assignmentCapabilities()`, т.е. по
 * таблице переходов ТЗ 13.3.
 */
export function AssignmentsPage(): JSX.Element {
  const scope = useLeadScope();
  const navigate = useNavigate();
  const toast = useToast();
  const allOwnAssignments = useScopedLeadAssignments();
  const mentorNameOf = useLeadMentorNameResolver();
  const actions = useAssignmentActions();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [formDrawer, setFormDrawer] = useState<AssignmentFormDrawerState | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);
  const [reassignDialog, setReassignDialog] = useState<LeadAssignmentRecord | null>(null);

  const assignmentId = searchParams.get('assignmentId');
  const selected = useResolvedLeadAssignment(assignmentId);

  // Раздел 6 задачи Phase 3: невалидный/чужой assignmentId в URL — тихо убираем параметр, без раскрытия деталей.
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

  const mentors = useActiveLeadMentors();
  const mentorOptions = [{ value: 'all', label: 'Все менторы' }, ...mentors.map((m) => ({ value: m.id, label: m.fullName }))];
  const filtersActive = search.trim().length > 0 || mentorFilter !== 'all';

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allOwnAssignments.filter((a) => {
      if (query.length > 0) {
        const mentorName = mentorNameOf(a.mentorId).toLowerCase();
        if (!a.title.toLowerCase().includes(query) && !mentorName.includes(query)) return false;
      }
      if (mentorFilter !== 'all' && a.mentorId !== mentorFilter) return false;
      return true;
    });
  }, [allOwnAssignments, search, mentorFilter, mentorNameOf]);

  const kpis = useMemo(() => ({
    active: allOwnAssignments.filter((a) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(a.status)).length,
    awaitingReview: allOwnAssignments.filter((a) => a.status === 'Submitted' || a.status === 'InReview').length,
    rework: allOwnAssignments.filter((a) => a.status === 'NeedsRework').length,
    overdue: allOwnAssignments.filter((a) => a.status === 'Overdue').length,
    approved: allOwnAssignments.filter((a) => a.status === 'Approved').length,
  }), [allOwnAssignments]);

  async function runAction(action: () => Promise<unknown>, successMessage: string): Promise<void> {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось выполнить действие');
    }
  }

  function token(a: LeadAssignmentRecord): string {
    return a.concurrencyToken ?? '';
  }

  /** Единственное место, где строится список действий карточки (раздел I промпта: только реально применимые). */
  function buildActionItems(a: LeadAssignmentRecord): PreviewActionMenuItem[] {
    const caps = assignmentCapabilities(a);
    return [
      { label: 'Открыть', onClick: () => { openRow(a.id); } },
      ...(caps.canEdit ? [{ label: 'Редактировать', onClick: () => { setFormDrawer({ mode: 'edit', assignmentId: a.id }); } }] : []),
      ...(caps.canPublish ? [{ label: 'Опубликовать', onClick: () => { void runAction(() => actions.publish(a.id, token(a)), 'Задание опубликовано'); } }] : []),
      ...(caps.canAcceptSuggestion ? [{ label: 'Принять', onClick: () => { void runAction(() => actions.acceptSuggestion(a.id, token(a)), 'Предложение принято'); } }] : []),
      ...(caps.canReassign ? [{ label: 'Переназначить', onClick: () => { setReassignDialog(a); } }] : []),
      ...(caps.canStartReview ? [{ label: 'Начать проверку', onClick: () => { void runAction(() => actions.startReview(a.id, token(a)), 'Проверка начата'); navigate(`/lead/review-queue?assignmentId=${a.id}`); } }] : []),
      ...(caps.canReject ? [{ label: 'Отклонить', destructive: true, onClick: () => { setCancelDialog({ assignment: a, kind: 'reject' }); } }] : []),
      ...(caps.canCancel ? [{ label: 'Отменить', destructive: true, onClick: () => { setCancelDialog({ assignment: a, kind: 'cancel' }); } }] : []),
    ];
  }

  return (
    <div className="space-y-5">
      <PreviewPageHeader
        title="Задания"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName}`}
        action={
          <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormDrawer({ mode: 'create' }); }}>
            Новое задание
          </Button>
        }
      />

      <AssignmentsKpiStrip
        items={[
          { icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />, label: 'Активные', value: kpis.active },
          { icon: <Clock3 className="h-4 w-4" aria-hidden="true" />, label: 'Ожидают проверки', value: kpis.awaitingReview },
          { icon: <Wrench className="h-4 w-4" aria-hidden="true" />, label: 'На доработке', value: kpis.rework },
          { icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" />, label: 'Просрочено', value: kpis.overdue, tone: 'warning' },
          { icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />, label: 'Одобрено', value: kpis.approved },
        ]}
      />

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 sm:px-6">
          <PreviewSearchInput placeholder="Поиск по названию или ментору" value={search} onChange={setSearch} className="!min-w-[240px]" />
          <PreviewSelect label="Ментор" value={mentorFilter} onChange={setMentorFilter} options={mentorOptions} className="w-[200px]" />
          <button
            type="button"
            disabled={!filtersActive}
            onClick={() => { setSearch(''); setMentorFilter('all'); }}
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            Сбросить
          </button>
        </div>
      </Card>

      <AssignmentsKanbanBoard
        assignments={filtered}
        timeZoneId={scope.timeZoneId}
        selectedId={assignmentId}
        onOpen={openRow}
        getActionItems={buildActionItems}
        mentorNameOf={mentorNameOf}
      />

      <LeadAssignmentDetailsDrawer
        assignment={selected}
        assignmentId={assignmentId}
        onClose={closeDrawer}
        mentorNameOf={mentorNameOf}
        onEdit={(a) => { setFormDrawer({ mode: 'edit', assignmentId: a.id }); }}
        onPublish={(a) => { void runAction(() => actions.publish(a.id, token(a)), 'Задание опубликовано'); }}
        onAcceptSuggestion={(a) => { void runAction(() => actions.acceptSuggestion(a.id, token(a)), 'Предложение принято'); }}
        onReject={(a) => { setCancelDialog({ assignment: a, kind: 'reject' }); }}
        onCancel={(a) => { setCancelDialog({ assignment: a, kind: 'cancel' }); }}
        onReassign={(a) => { setReassignDialog(a); }}
        onStartReview={(a) => { void runAction(() => actions.startReview(a.id, token(a)), 'Проверка начата'); navigate(`/lead/review-queue?assignmentId=${a.id}`); }}
        onOpenReview={(a) => { navigate(`/lead/review-queue?assignmentId=${a.id}`); }}
      />

      <AssignmentFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} />

      <AssignmentCancelDialog
        open={cancelDialog !== null}
        onOpenChange={(next) => { if (!next) setCancelDialog(null); }}
        title={cancelDialog?.kind === 'reject' ? 'Отклонить предложение' : 'Отменить задание'}
        assignmentTitle={cancelDialog?.assignment.title ?? ''}
        confirmLabel={cancelDialog?.kind === 'reject' ? 'Отклонить' : 'Отменить задание'}
        onConfirm={(reason) => {
          if (cancelDialog === null) return;
          // LA10: и «Отменить», и «Отклонить предложение» — один и тот же POST /assignments/{id}/cancel
          // (ASN-012: отклонение предложения — это отмена Suggested-статуса с причиной).
          void runAction(
            () => actions.cancel(cancelDialog.assignment.id, token(cancelDialog.assignment), reason),
            cancelDialog.kind === 'reject' ? 'Предложение отклонено' : 'Задание отменено',
          );
          setCancelDialog(null);
        }}
      />

      <ReassignAssignmentDialog
        open={reassignDialog !== null}
        onOpenChange={(next) => { if (!next) setReassignDialog(null); }}
        assignmentTitle={reassignDialog?.title ?? ''}
        currentMentorId={reassignDialog?.mentorId ?? ''}
        onConfirm={(mentorId) => {
          if (reassignDialog === null) return;
          void runAction(() => actions.reassign(reassignDialog.id, token(reassignDialog), mentorId), 'Задание переназначено');
          setReassignDialog(null);
        }}
      />
    </div>
  );
}
