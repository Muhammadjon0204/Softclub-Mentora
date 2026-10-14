import { Plus, Tags, TriangleAlert, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { branchDisplayName } from '../../features/admin-preview/branchDirectory';
import { ActivateCategoryDialog } from '../../features/admin-categories/ActivateCategoryDialog';
import { AssignCategoryLeadDialog } from '../../features/admin-categories/AssignCategoryLeadDialog';
import { CategoryActionMenu } from '../../features/admin-categories/CategoryActionMenu';
import { CategoryDetailsDrawer } from '../../features/admin-categories/CategoryDetailsDrawer';
import { CategoryFormDrawer } from '../../features/admin-categories/CategoryFormDrawer';
import type { CategoryFormDrawerState } from '../../features/admin-categories/CategoryFormDrawer';
import { ChangeCategoryLeadDialog } from '../../features/admin-categories/ChangeCategoryLeadDialog';
import { DeactivateCategoryDialog } from '../../features/admin-categories/DeactivateCategoryDialog';
import { useCategoryActions } from '../../features/admin-categories/useCategoryActions';
import { CATEGORY_COLOR_TILE } from '../../features/admin-categories/categoryPresentation';
import { pluralizeRu } from '../../features/admin-assignments/assignmentPresentation';
import { useAssignmentStats } from '../../features/admin-assignments/useAssignmentStats';
import type { PreviewCategoryDetails } from '../../features/admin-categories/categoryPresentation';
import { useCategoriesQuery } from '../../features/admin-categories/useCategoriesQuery';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Tooltip } from '../../shared/ui/Tooltip';

const LEAD_OPTIONS = [
  { value: 'all', label: 'Все руководители' },
  { value: 'assigned', label: 'С руководителем' },
  { value: 'unassigned', label: 'Без руководителя' },
];

type ActionDialogState =
  | { type: 'assignLead'; category: PreviewCategoryDetails }
  | { type: 'changeLead'; category: PreviewCategoryDetails }
  | { type: 'activate'; category: PreviewCategoryDetails }
  | { type: 'deactivate'; category: PreviewCategoryDetails };

/**
 * /admin/categories — подключено к реальному API (`GET/POST /categories` + `activate`/
 * `deactivate`/settings). Список зависит от текущего branch-context (см. `useCategoriesQuery.ts`):
 * конкретный выбранный филиал сужает результат сервера, «Все филиалы» — вся организация.
 * Branch Admin видит и создаёт направления только своего филиала — сервер сам сужает (CAT-025).
 */
export function CategoriesPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const branchContext = useBranchContext();
  const navigate = useNavigate();

  const categoriesQuery = useCategoriesQuery();
  const scopedCategories = categoriesQuery.categories;

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('category') ?? '');
  const [branch, setBranch] = useState('all');
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
      if (branch !== 'all' && category.branchId !== branch) return false;
      if (leadFilter === 'assigned' && category.leadName === null) return false;
      if (leadFilter === 'unassigned' && category.leadName !== null) return false;
      return true;
    });
  }, [scopedCategories, search, branch, leadFilter]);

  const stats = useAssignmentStats();
  const withLead = scopedCategories.filter((c) => c.leadName !== null).length;
  const totalMentors = scopedCategories.reduce((sum, c) => sum + c.mentorsCount, 0);
  const needsAttention = scopedCategories.filter((c) => c.leadName === null).length;

  const actions = useCategoryActions();

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Категории"
        subtitle="Учебные направления, их руководители и команды менторов"
        action={
          <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormDrawer({ mode: 'create' }); }}>
            Создать категорию
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewMetricCard icon={<Tags />} label="Всего направлений" value={String(scopedCategories.length)} />
        <PreviewMetricCard icon={<UserCheck />} label="С руководителем" value={String(withLead)} />
        <PreviewMetricCard icon={<UsersIcon />} label="Менторы" value={String(totalMentors)} />
        <PreviewMetricCard
          icon={<TriangleAlert />}
          label="Без руководителя"
          value={String(needsAttention)}
          hint={needsAttention > 0 ? 'Нажмите, чтобы показать' : 'У всех есть руководитель'}
          tone={needsAttention > 0 ? 'warning' : 'default'}
          onClick={needsAttention > 0 ? () => { setLeadFilter(leadFilter === 'unassigned' ? 'all' : 'unassigned'); } : undefined}
          active={leadFilter === 'unassigned'}
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
              options={[{ value: 'all', label: 'Все филиалы' }, ...branchContext.availableBranches.map((b) => ({ value: b.id, label: b.name }))]}
              width="lg"
            />
          ) : null}
          <PreviewSelect label="Руководитель" value={leadFilter} onChange={setLeadFilter} options={LEAD_OPTIONS} width="md" />
          <PreviewResetButton
            disabled={search.trim() === '' && branch === 'all' && leadFilter === 'all'}
            onClick={() => {
              setSearch('');
              setBranch('all');
              setLeadFilter('all');
            }}
          />
        </PreviewToolbar>

        {categoriesQuery.isPending ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-muted sm:px-6">Загрузка направлений…</p>
        ) : categoriesQuery.error !== null ? (
          <div className="px-5 py-2 sm:px-6">
            <ErrorState error={categoriesQuery.error} title="Не удалось загрузить направления" onRetry={categoriesQuery.refetch} />
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-2">
          {cards.map((category) => {
            const isUnassigned = category.leadName === null;
            const s = stats.byCategory.get(category.id);
            const efficiency = s?.completionPct ?? null;
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
                className={`cursor-pointer rounded-card border p-4 outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  category.id === categoryId ? 'border-brand ring-1 ring-brand' : isUnassigned ? 'border-warning-border bg-surface hover:bg-surface-hover' : 'border-line bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${CATEGORY_COLOR_TILE[category.colorToken]}`}>
                      <Tags className="h-4 w-4" aria-hidden="true" />
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

                <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-ink-muted">Руководитель</span>
                  {isUnassigned ? (
                    <Badge tone="warning">Не назначен</Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (category.leadUserId !== null) navigate(`/admin/users?userId=${category.leadUserId}`);
                      }}
                      className="inline-flex min-w-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 font-medium text-ink transition hover:bg-brand-soft hover:text-brand-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <Avatar name={category.leadName ?? ''} size="xs" />
                      <span className="truncate">{category.leadName}</span>
                    </button>
                  )}
                </div>

                <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider pt-3 text-[12.5px] text-ink-secondary">
                  <div><dt className="sr-only">Менторы</dt><dd><span className="font-semibold tabular-nums text-ink">{category.mentorsCount}</span> {pluralizeRu(category.mentorsCount, 'ментор', 'ментора', 'менторов')}</dd></div>
                  <div><dt className="sr-only">В работе</dt><dd><span className="font-semibold tabular-nums text-ink">{s?.active ?? 0}</span> в работе</dd></div>
                  <div><dt className="sr-only">На проверке</dt><dd><span className={`font-semibold tabular-nums ${(s?.inReview ?? 0) > 0 ? 'text-warning' : 'text-ink'}`}>{s?.inReview ?? 0}</span> на проверке</dd></div>
                  {(s?.overdue ?? 0) > 0 ? (
                    <div><dt className="sr-only">Просрочено</dt><dd><span className="font-semibold tabular-nums text-danger">{s?.overdue}</span> просрочено</dd></div>
                  ) : null}
                </dl>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <Tooltip content="Доля одобренных среди всех назначенных заданий направления (без черновиков и отменённых).">
                      <span className="cursor-help text-ink-muted">Эффективность</span>
                    </Tooltip>
                    {efficiency === null ? (
                      <span className="text-ink-disabled">— нет заданий</span>
                    ) : (
                      <span className="font-semibold tabular-nums text-ink">
                        {efficiency}% <span className="font-normal text-ink-muted">· {s?.approved} из {(s?.total ?? 0) - (s?.cancelled ?? 0)}</span>
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${String(efficiency ?? 0)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </Card>

      <CategoryDetailsDrawer
        categoryId={categoryId}
        categories={scopedCategories}
        onClose={closeCategoryDetails}
        canManage
        onOpenUser={(userId) => { navigate(`/admin/users?userId=${userId}`); }}
        onEdit={(target) => { setFormDrawer({ mode: 'edit', categoryId: target.id }); }}
        onAssignLead={(target) => { setActionDialog({ type: 'assignLead', category: target }); }}
        onChangeLead={(target) => { setActionDialog({ type: 'changeLead', category: target }); }}
        onActivate={(target) => { setActionDialog({ type: 'activate', category: target }); }}
        onDeactivate={(target) => { setActionDialog({ type: 'deactivate', category: target }); }}
      />

      <CategoryFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} isOrgAdmin={isOrgAdmin} />

      <AssignCategoryLeadDialog
        category={actionDialog?.type === 'assignLead' ? actionDialog.category : null}
        open={actionDialog?.type === 'assignLead'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (lead) => {
          if (actionDialog?.type === 'assignLead') await actions.assignLead(actionDialog.category, lead);
        }}
      />

      <ChangeCategoryLeadDialog
        category={actionDialog?.type === 'changeLead' ? actionDialog.category : null}
        open={actionDialog?.type === 'changeLead'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'changeLead') await actions.changeLead(actionDialog.category, input);
        }}
      />

      <ActivateCategoryDialog
        category={actionDialog?.type === 'activate' ? actionDialog.category : null}
        open={actionDialog?.type === 'activate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'activate') await actions.activateCategory(actionDialog.category.id, actionDialog.category.concurrencyToken ?? '');
        }}
      />

      <DeactivateCategoryDialog
        category={actionDialog?.type === 'deactivate' ? actionDialog.category : null}
        open={actionDialog?.type === 'deactivate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'deactivate') await actions.deactivateCategory(actionDialog.category.id, actionDialog.category.concurrencyToken ?? '');
        }}
      />
    </div>
  );
}
