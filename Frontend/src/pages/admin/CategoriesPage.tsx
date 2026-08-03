import { Plus, Tags, TriangleAlert, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import { PREVIEW_CATEGORIES, type PreviewCategoryColor } from '../../mocks/ui-preview/categories.preview';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  { value: 'Главный офис', label: 'Главный офис' },
  { value: 'Филиал Худжанд', label: 'Филиал Худжанд' },
  { value: 'Филиал Бохтар', label: 'Филиал Бохтар' },
];
const LEAD_OPTIONS = [
  { value: 'all', label: 'Lead: все' },
  { value: 'assigned', label: 'Lead назначен' },
  { value: 'unassigned', label: 'Lead не назначен' },
];

const COLOR_TILE: Record<PreviewCategoryColor, string> = {
  indigo: 'bg-brand-soft text-brand',
  blue: 'bg-info-soft text-info',
  cyan: 'bg-[var(--secondary-cyan)]/15 text-[var(--secondary-cyan)]',
  violet: 'bg-[var(--secondary-violet)]/15 text-[var(--secondary-violet)]',
};

const COLOR_BAR: Record<PreviewCategoryColor, string> = {
  indigo: 'bg-brand',
  blue: 'bg-info',
  cyan: 'bg-[var(--secondary-cyan)]',
  violet: 'bg-[var(--secondary-violet)]',
};

function healthTone(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 90) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
}

/** UI-прототип /admin/categories — сетка карточек вместо плотной таблицы (раздел 8 сессии превью). */
export function CategoriesPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [leadFilter, setLeadFilter] = useState('all');
  const [toastMessage, showToast] = usePreviewToast();

  const cards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_CATEGORIES.filter((category) => {
      if (query.length > 0 && !category.name.toLowerCase().includes(query)) return false;
      if (branch !== 'all' && category.branchName !== branch) return false;
      if (leadFilter === 'assigned' && category.leadName === null) return false;
      if (leadFilter === 'unassigned' && category.leadName !== null) return false;
      return true;
    });
  }, [search, branch, leadFilter]);

  const withLead = PREVIEW_CATEGORIES.filter((c) => c.leadName !== null).length;
  const totalMentors = PREVIEW_CATEGORIES.reduce((sum, c) => sum + c.mentorsCount, 0);
  const needsAttention = PREVIEW_CATEGORIES.filter((c) => c.leadName === null).length;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Категории"
        subtitle="Учебные направления и их команды"
        action={
          <Button
            variant="primary"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              showToast('Функция будет подключена позже');
            }}
          >
            Создать категорию
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Tags className="h-5 w-5" aria-hidden="true" />} label="Всего категорий" value={String(PREVIEW_CATEGORIES.length)} />
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
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
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
                className={`rounded-panel border p-4 ${isUnassigned ? 'border-warning-border bg-warning-soft/40' : 'border-line bg-surface'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${COLOR_TILE[category.colorToken]}`}>
                      <Tags className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{category.name}</p>
                      <p className="text-[12px] text-ink-muted">{category.branchName}</p>
                    </div>
                  </div>
                  <PreviewActionMenu
                    items={[
                      { label: 'Открыть', onClick: () => { showToast('Функция будет подключена позже'); } },
                      { label: 'Назначить Lead', onClick: () => { showToast('Функция будет подключена позже'); } },
                      { label: 'Архивировать', destructive: true, onClick: () => { showToast('Функция будет подключена позже'); } },
                    ]}
                  />
                </div>

                <div className="mt-3.5 flex items-center justify-between text-[13px]">
                  <span className="text-ink-muted">Lead</span>
                  {isUnassigned ? (
                    <Badge tone="warning">Lead не назначен</Badge>
                  ) : (
                    <span className="font-medium text-ink">{category.leadName}</span>
                  )}
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
                    <div className={`h-full rounded-full ${COLOR_BAR[category.colorToken]}`} style={{ width: `${category.healthPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <PreviewToast message={toastMessage} />
    </div>
  );
}
