import { Building2, Plus, Power, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewActionCell, PreviewActionTh, PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PREVIEW_BRANCH_USER_DISTRIBUTION } from '../../mocks/ui-preview/branches.preview';
import { ActivateBranchDialog } from '../../features/admin-branches/ActivateBranchDialog';
import { AssignBranchAdminDialog } from '../../features/admin-branches/AssignBranchAdminDialog';
import { BranchActionMenu } from '../../features/admin-branches/BranchActionMenu';
import { BranchDetailsDrawer } from '../../features/admin-branches/BranchDetailsDrawer';
import { BranchFormDrawer } from '../../features/admin-branches/BranchFormDrawer';
import type { BranchFormDrawerState } from '../../features/admin-branches/BranchFormDrawer';
import { ChangeBranchAdminDialog } from '../../features/admin-branches/ChangeBranchAdminDialog';
import { DeactivateBranchDialog } from '../../features/admin-branches/DeactivateBranchDialog';
import { useBranchPreviewActions } from '../../features/admin-branches/useBranchPreviewActions';
import type { PreviewBranchDetails } from '../../features/admin-branches/branchPresentation';
import { useBranchesPreview } from '../../features/admin-branches/branchPreviewStore';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { StatusDot } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card, SectionCard } from '../../shared/ui/Card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'active', label: 'Активные' },
  { value: 'inactive', label: 'Неактивные' },
];

function healthToneClasses(value: number): { text: string; bar: string } {
  if (value >= 90) return { text: 'text-success', bar: 'bg-success' };
  if (value >= 75) return { text: 'text-warning', bar: 'bg-warning' };
  return { text: 'text-danger', bar: 'bg-danger' };
}

function formatStreet(address: string): string {
  return address.replace(/^г\.\s*[^,]+,\s*/, '');
}

function HealthValue({ value }: { value: number }): JSX.Element {
  const tone = healthToneClasses(value);
  return (
    <div>
      <span className={`text-[13.5px] font-semibold tabular-nums ${tone.text}`}>{value}%</span>
      <div className="mt-1 h-[3px] w-9 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

type ActionDialogState =
  | { type: 'assignAdmin'; branch: PreviewBranchDetails }
  | { type: 'changeAdmin'; branch: PreviewBranchDetails }
  | { type: 'activate'; branch: PreviewBranchDetails }
  | { type: 'deactivate'; branch: PreviewBranchDetails };

/**
 * /admin/branches — этап 2: реальные Drawer/Dialog поверх shared overlay system.
 * Branch Admin видит только свой филиал, read-only (раздел 3/31 промпта).
 */
export function BranchesPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const currentBranchId = authUser?.branch?.id ?? null;
  const navigate = useNavigate();
  const realBranchContext = useBranchContext();

  const allBranches = useBranchesPreview();
  // `PreviewBranch.name` — городское display-имя ("Худжанд"), а `authUser.branch.name` —
  // институциональное («Филиал Худжанд», см. branchDirectory.ts) — сравнивать нужно по `id`.
  const scopedBranches = useMemo(
    () => (isOrgAdmin ? allBranches : allBranches.filter((candidate) => candidate.id === currentBranchId)),
    [allBranches, isOrgAdmin, currentBranchId],
  );

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [formDrawer, setFormDrawer] = useState<BranchFormDrawerState | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const branchId = searchParams.get('branchId');
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (branchId === null) return;
    rowRefs.current.get(branchId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [branchId]);

  function openBranchDetails(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('branchId', id);
    setSearchParams(next);
  }

  function closeBranchDetails(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('branchId');
    setSearchParams(next);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedBranches.filter((candidate) => {
      if (query.length > 0 && !candidate.name.toLowerCase().includes(query) && !candidate.code.toLowerCase().includes(query)) return false;
      if (status === 'active' && !candidate.isActive) return false;
      if (status === 'inactive' && candidate.isActive) return false;
      return true;
    });
  }, [scopedBranches, search, status]);

  const filtersActive = search.trim().length > 0 || status !== 'all';

  const totalCategories = scopedBranches.reduce((sum, b) => sum + b.categoriesCount, 0);
  const activeCount = scopedBranches.filter((b) => b.isActive).length;
  const withoutAdmin = scopedBranches.filter((b) => b.adminUserId === null).length;

  const distributionTotal = PREVIEW_BRANCH_USER_DISTRIBUTION.reduce((sum, entry) => sum + entry.count, 0);
  const userDistribution = PREVIEW_BRANCH_USER_DISTRIBUTION.map((entry) => ({
    ...entry,
    pct: distributionTotal === 0 ? 0 : Math.round((entry.count / distributionTotal) * 100),
  }));

  const actions = useBranchPreviewActions();

  async function handleDeactivate(target: PreviewBranchDetails): Promise<void> {
    await actions.deactivateBranch(target.id);
    // Раздел 34 промпта: если деактивированный филиал был выбран в реальном BranchContext,
    // Organization Admin переключается на «Все филиалы» — контекст не должен «зависать» на неактивном.
    if (isOrgAdmin && realBranchContext.selectedBranchId === target.id) {
      realBranchContext.clearBranchContext();
    }
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title={isOrgAdmin ? 'Филиалы' : 'Филиал'}
        subtitle={isOrgAdmin ? 'Управление филиалами и их текущим состоянием' : 'Профиль вашего филиала — доступен только для чтения'}
        action={
          isOrgAdmin ? (
            <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormDrawer({ mode: 'create' }); }}>
              Добавить филиал
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Building2 className="h-5 w-5" aria-hidden="true" />} label="Всего филиалов" value={String(scopedBranches.length)} />
        <PreviewMetricCard icon={<Power className="h-5 w-5" aria-hidden="true" />} label="Активные" value={String(activeCount)} />
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Категории" value={String(totalCategories)} />
        <PreviewMetricCard icon={<Building2 className="h-5 w-5" aria-hidden="true" />} label="Без администратора" value={String(withoutAdmin)} tone={withoutAdmin > 0 ? 'warning' : 'default'} />
      </div>

      <div className={`grid grid-cols-1 items-start gap-4 ${isOrgAdmin ? 'min-[1600px]:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
        <Card padded={false} className="min-w-0">
          <PreviewToolbar>
            <PreviewSearchInput placeholder="Поиск по названию или коду…" value={search} onChange={setSearch} />
            <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} width="sm" />
            <PreviewResetButton disabled={!filtersActive} onClick={() => { setSearch(''); setStatus('all'); }} />
          </PreviewToolbar>

          <PreviewTable>
            <PreviewTableHead>
              <PreviewTh>Филиал</PreviewTh>
              <PreviewTh className="w-[160px]">Администратор</PreviewTh>
              <PreviewTh className="w-20">Категории</PreviewTh>
              <PreviewTh className="w-20">Менторы</PreviewTh>
              <PreviewTh className="w-[105px]">Активные задания</PreviewTh>
              <PreviewTh className="w-[100px]">Статус</PreviewTh>
              <PreviewTh className="w-20">Здоровье</PreviewTh>
              <PreviewActionTh />
            </PreviewTableHead>
            <tbody>
              {rows.map((branchRow) => (
                <tr
                  key={branchRow.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(branchRow.id, node);
                    else rowRefs.current.delete(branchRow.id);
                  }}
                  tabIndex={0}
                  onClick={() => { openBranchDetails(branchRow.id); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openBranchDetails(branchRow.id);
                    }
                  }}
                  className={`h-14 cursor-pointer border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                    branchRow.id === branchId ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                  }`}
                >
                  <PreviewTd className="text-ink">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <PreviewCellStack primary={branchRow.name} secondary={`${branchRow.code} · ${formatStreet(branchRow.address)}`} tooltip={branchRow.name} />
                    </div>
                  </PreviewTd>
                  <PreviewTd>
                    {branchRow.adminName ?? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-warning">
                        <StatusDot tone="warning" />
                        Не назначен
                      </span>
                    )}
                  </PreviewTd>
                  <PreviewTd className="tabular-nums">{branchRow.categoriesCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branchRow.mentorsCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branchRow.activeAssignments}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${branchRow.isActive ? 'text-success' : 'text-ink-muted'}`}>
                      <StatusDot tone={branchRow.isActive ? 'success' : 'neutral'} />
                      {branchRow.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <HealthValue value={branchRow.healthPct} />
                  </PreviewTd>
                  <PreviewActionCell
                    onClick={(event) => { event.stopPropagation(); }}
                  >
                    <BranchActionMenu
                      branch={branchRow}
                      context="row"
                      isOrgAdmin={isOrgAdmin}
                      onOpenDetails={() => { openBranchDetails(branchRow.id); }}
                      onEdit={() => { setFormDrawer({ mode: 'edit', branchId: branchRow.id }); }}
                      onAssignAdmin={() => { setActionDialog({ type: 'assignAdmin', branch: branchRow }); }}
                      onChangeAdmin={() => { setActionDialog({ type: 'changeAdmin', branch: branchRow }); }}
                      onActivate={() => { setActionDialog({ type: 'activate', branch: branchRow }); }}
                      onDeactivate={() => { setActionDialog({ type: 'deactivate', branch: branchRow }); }}
                    />
                  </PreviewActionCell>
                </tr>
              ))}
            </tbody>
          </PreviewTable>
        </Card>

        {isOrgAdmin ? (
          <SectionCard
            title="Распределение пользователей"
            description={`${distributionTotal} по филиалам`}
            className="h-fit self-start"
            padded
          >
            <ul className="space-y-3">
              {userDistribution.map((entry, index) => (
                <li key={entry.label} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-ink-disabled">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-ink">{entry.label}</span>
                      <span className="shrink-0 text-[12.5px] tabular-nums">
                        <span className="font-semibold text-ink">{entry.count}</span>
                        <span className="ml-1 text-ink-muted">{entry.pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${entry.pct}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>

      <BranchDetailsDrawer
        branchId={branchId}
        branches={scopedBranches}
        onClose={closeBranchDetails}
        isOrgAdmin={isOrgAdmin}
        onOpenUser={(userId) => { navigate(`/admin/users?userId=${userId}`); }}
        onEdit={(target) => { setFormDrawer({ mode: 'edit', branchId: target.id }); }}
        onAssignAdmin={(target) => { setActionDialog({ type: 'assignAdmin', branch: target }); }}
        onChangeAdmin={(target) => { setActionDialog({ type: 'changeAdmin', branch: target }); }}
        onActivate={(target) => { setActionDialog({ type: 'activate', branch: target }); }}
        onDeactivate={(target) => { setActionDialog({ type: 'deactivate', branch: target }); }}
      />

      <BranchFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} />

      <AssignBranchAdminDialog
        branch={actionDialog?.type === 'assignAdmin' ? actionDialog.branch : null}
        open={actionDialog?.type === 'assignAdmin'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (adminUserId) => {
          if (actionDialog?.type === 'assignAdmin') await actions.assignAdmin(actionDialog.branch.id, adminUserId);
        }}
      />

      <ChangeBranchAdminDialog
        branch={actionDialog?.type === 'changeAdmin' ? actionDialog.branch : null}
        open={actionDialog?.type === 'changeAdmin'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'changeAdmin') await actions.changeAdmin(actionDialog.branch.id, input);
        }}
      />

      <ActivateBranchDialog
        branch={actionDialog?.type === 'activate' ? actionDialog.branch : null}
        open={actionDialog?.type === 'activate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'activate') await actions.activateBranch(actionDialog.branch.id);
        }}
      />

      <DeactivateBranchDialog
        branch={actionDialog?.type === 'deactivate' ? actionDialog.branch : null}
        open={actionDialog?.type === 'deactivate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'deactivate') await handleDeactivate(actionDialog.branch);
        }}
      />
    </div>
  );
}
