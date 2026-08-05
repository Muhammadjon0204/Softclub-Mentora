import { Plus, Tags, TriangleAlert, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { BRANCH_DIRECTORY, branchDisplayName } from '../../features/admin-preview/branchDirectory';
import { ActivateCategoryDialog } from '../../features/admin-categories/ActivateCategoryDialog';
import { AssignCategoryLeadDialog } from '../../features/admin-categories/AssignCategoryLeadDialog';
import { CategoryActionMenu } from '../../features/admin-categories/CategoryActionMenu';
import { CategoryDetailsDrawer } from '../../features/admin-categories/CategoryDetailsDrawer';
import { CategoryFormDrawer } from '../../features/admin-categories/CategoryFormDrawer';
import type { CategoryFormDrawerState } from '../../features/admin-categories/CategoryFormDrawer';
import { ChangeCategoryLeadDialog } from '../../features/admin-categories/ChangeCategoryLeadDialog';
import { DeactivateCategoryDialog } from '../../features/admin-categories/DeactivateCategoryDialog';
import { useCategoryPreviewActions } from '../../features/admin-categories/useCategoryPreviewActions';
import { CATEGORY_COLOR_TILE, healthTone } from '../../features/admin-categories/categoryPresentation';
import type { PreviewCategoryDetails } from '../../features/admin-categories/categoryPresentation';
import { useCategoriesPreviewResolved } from '../../features/admin-categories/categoryPreviewStore';
import { useAuth } from '../../auth/useAuth';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

const LEAD_OPTIONS = [
  { value: 'all', label: 'Lead: все' },
  { value: 'assigned', label: 'Lead назначен' },
  { value: 'unassigned', label: 'Lead не назначен' },
];

type ActionDialogState =
  | { type: 'assignLead'; category: PreviewCategoryDetails }
  | { type: 'changeLead'; category: PreviewCategoryDetails }
  | { type: 'activate'; category: PreviewCategoryDetails }
  | { type: 'deactivate'; category: PreviewCategoryDetails };

/**
 * /admin/categories — этап 3: реальные Drawer/Dialog поверх shared overlay
 * system. Branch Admin видит и создаёт направления только своего филиала
 * (раздел 39 промпта — branch isolation).
 */
export function CategoriesPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const currentBranchRawName = authUser?.branch?.name ?? null;
  const navigate = useNavigate();

  const allCategories = useCategoriesPreviewResolved();
  const scopedCategories = useMemo(
    () => (isOrgAdmin ? allCategories : allCategories.filter((candidate) => candidate.branchName === currentBranchRawName)),
    [allCategories, isOrgAdmin, currentBranchRawName],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('category') ?? '');
  const [branch, setBranch] = useState(() => searchParams.get('branch') ?? 'all');
  const [leadFilter, setLeadFilter] = useState('all');
  const [formDrawer, setFormDrawer] = useState<CategoryFormDrawerState | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);

  const categoryId = searchParams.get('categoryId');
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (categoryId === null) return;
    cardRefs.current.get(categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [categoryId]);

  function openCategoryDetails(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('categoryId', id);
    setSearchParams(next);
  }

  function closeCategoryDetails(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('categoryId');
    setSearchParams(next);
  }

  const cards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedCategories.filter((category) => {
      if (query.length > 0 && !category.name.toLowerCase().includes(query)) return false;
      if (branch !== 'all' && category.branchName !== branch) return false;
      if (leadFilter === 'assigned' && category.leadName === null) return false;
      if (leadFilter === 'unassigned' && category.leadName !== null) return false;
      return true;
    });
  }, [scopedCategories, search, branch, leadFilter]);

  const withLead = scopedCategories.filter((c) => c.leadName !== null).length;
  const totalMentors = scopedCategories.reduce((sum, c) => sum + c.mentorsCount, 0);
  const needsAttention = scopedCategories.filter((c) => c.leadName === null).length;

  const actions = useCategoryPreviewActions();

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Категории"
        subtitle="Учебные направления и их команды"
        action={
          <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormDrawer({ mode: 'create' }); }}>
            Создать категорию
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Tags className="h-5 w-5" aria-hidden="true" />} label="Всего категорий" value={String(scopedCategories.length)} />
        <PreviewMetricCard icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} label="С активным Lead" value={String(withLead)} />
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Менторы" value={String(totalMentors)} />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          label="Требуют внимания"
          value={String(needsAttention)}
          tone={needsAttention > 0 ? 'warning' : 'default'}
        />
      </div>

      <Card padded={false}>
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по названию…" value={search} onChange={setSearch} />
          {isOrgAdmin ? (
            <PreviewSelect
              label="Филиал"
              value={branch}
              onChange={setBranch}
              options={[{ value: 'all', label: 'Все филиалы' }, ...BRANCH_DIRECTORY.map((b) => ({ value: b.rawName, label: b.displayName }))]}
            />
          ) : null}
          <PreviewSelect label="Lead" value={leadFilter} onChange={setLeadFilter} options={LEAD_OPTIONS} />
          <PreviewResetButton
            onClick={() => {
              setSearch('');
              setBranch('all');
              setLeadFilter('all');
            }}
          />
        </PreviewToolbar>

        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-2">
          {cards.map((category) => {
            const isUnassigned = category.leadName === null;
            return (
              <div
                key={category.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(category.id, node);
                  else cardRefs.current.delete(category.id);
                }}
                tabIndex={0}
                role="button"
                aria-label={`Открыть направление ${category.name}`}
                onClick={() => { openCategoryDetails(category.id); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openCategoryDetails(category.id);
                  }
                }}
                className={`cursor-pointer rounded-panel border p-4 outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  category.id === categoryId ? 'border-brand ring-1 ring-brand' : isUnassigned ? 'border-warning-border bg-warning-soft/40' : 'border-line bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${CATEGORY_COLOR_TILE[category.colorToken]}`}>
                      <Tags className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{category.name}</p>
                      <p className="text-[12px] text-ink-muted">{branchDisplayName(category.branchName)}</p>
                    </div>
                  </div>
                  <div onClick={(event) => { event.stopPropagation(); }}>
                    <CategoryActionMenu
                      category={category}
                      context="card"
                      canManage
                      onOpenDetails={() => { openCategoryDetails(category.id); }}
                      onEdit={() => { setFormDrawer({ mode: 'edit', categoryId: category.id }); }}
                      onAssignLead={() => { setActionDialog({ type: 'assignLead', category }); }}
                      onChangeLead={() => { setActionDialog({ type: 'changeLead', category }); }}
                      onActivate={() => { setActionDialog({ type: 'activate', category }); }}
                      onDeactivate={() => { setActionDialog({ type: 'deactivate', category }); }}
                    />
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between text-[13px]">
                  <span className="text-ink-muted">Lead</span>
                  {isUnassigned ? <Badge tone="warning">Lead не назначен</Badge> : <span className="font-medium text-ink">{category.leadName}</span>}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">{category.mentorsCount}</p>
                    <p className="text-[11px] text-ink-muted">Менторы</p>
                  </div>
                  <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">{category.activeAssignments}</p>
                    <p className="text-[11px] text-ink-muted">Активные</p>
                  </div>
                  <div className="rounded-control-sm bg-surface-muted px-2 py-1.5">
                    <p className="text-[15px] font-semibold tabular-nums text-ink">{category.pendingReview}</p>
                    <p className="text-[11px] text-ink-muted">На проверке</p>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-ink-muted">Здоровье</span>
                    <Badge tone={healthTone(category.healthPct)}>{category.healthPct}%</Badge>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className={`h-full rounded-full ${CATEGORY_COLOR_TILE[category.colorToken].includes('brand') ? 'bg-brand' : 'bg-info'}`} style={{ width: `${category.healthPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <CategoryDetailsDrawer
        categoryId={categoryId}
        onClose={closeCategoryDetails}
        canManage
        onOpenUser={(userId) => { navigate(`/admin/users?userId=${userId}`); }}
        onEdit={(target) => { setFormDrawer({ mode: 'edit', categoryId: target.id }); }}
        onAssignLead={(target) => { setActionDialog({ type: 'assignLead', category: target }); }}
        onChangeLead={(target) => { setActionDialog({ type: 'changeLead', category: target }); }}
        onActivate={(target) => { setActionDialog({ type: 'activate', category: target }); }}
        onDeactivate={(target) => { setActionDialog({ type: 'deactivate', category: target }); }}
      />

      <CategoryFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} isOrgAdmin={isOrgAdmin} currentBranchRawName={currentBranchRawName} />

      <AssignCategoryLeadDialog
        category={actionDialog?.type === 'assignLead' ? actionDialog.category : null}
        open={actionDialog?.type === 'assignLead'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (leadUserId) => {
          if (actionDialog?.type === 'assignLead') await actions.assignLead(actionDialog.category.id, leadUserId);
        }}
      />

      <ChangeCategoryLeadDialog
        category={actionDialog?.type === 'changeLead' ? actionDialog.category : null}
        open={actionDialog?.type === 'changeLead'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'changeLead') await actions.changeLead(actionDialog.category.id, input);
        }}
      />

      <ActivateCategoryDialog
        category={actionDialog?.type === 'activate' ? actionDialog.category : null}
        open={actionDialog?.type === 'activate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'activate') await actions.activateCategory(actionDialog.category.id);
        }}
      />

      <DeactivateCategoryDialog
        category={actionDialog?.type === 'deactivate' ? actionDialog.category : null}
        open={actionDialog?.type === 'deactivate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'deactivate') await actions.deactivateCategory(actionDialog.category.id);
        }}
      />
    </div>
  );
}
