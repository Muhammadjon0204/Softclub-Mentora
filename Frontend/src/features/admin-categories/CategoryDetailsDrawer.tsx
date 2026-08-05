import { useEffect, useState } from 'react';

import { Drawer } from '../../shared/overlays';
import { ErrorState } from '../../shared/ui/ErrorState';
import { CategoryActionMenu } from './CategoryActionMenu';
import { CategoryActivitySection } from './CategoryActivitySection';
import { CategoryOverviewSection } from './CategoryOverviewSection';
import { CategoryPeopleSection } from './CategoryPeopleSection';
import { CategorySettingsSection } from './CategorySettingsSection';
import type { PreviewCategoryDetails } from './categoryPresentation';
import { useCategoriesPreviewResolved } from './categoryPreviewStore';

type CategoryDetailsTab = 'overview' | 'people' | 'settings' | 'activity';

const TABS: { id: CategoryDetailsTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'people', label: 'Команда' },
  { id: 'settings', label: 'Настройки' },
  { id: 'activity', label: 'Активность' },
];

export interface CategoryDetailsDrawerProps {
  categoryId: string | null;
  onClose: () => void;
  canManage: boolean;
  onOpenUser: (userId: string) => void;
  onEdit: (category: PreviewCategoryDetails) => void;
  onAssignLead: (category: PreviewCategoryDetails) => void;
  onChangeLead: (category: PreviewCategoryDetails) => void;
  onActivate: (category: PreviewCategoryDetails) => void;
  onDeactivate: (category: PreviewCategoryDetails) => void;
}

/** Открывается по клику на карточку направления (раздел 5 промпта). */
export function CategoryDetailsDrawer({
  categoryId,
  onClose,
  canManage,
  onOpenUser,
  onEdit,
  onAssignLead,
  onChangeLead,
  onActivate,
  onDeactivate,
}: CategoryDetailsDrawerProps): JSX.Element {
  const categories = useCategoriesPreviewResolved();
  const category = categoryId !== null ? categories.find((candidate) => candidate.id === categoryId) : undefined;
  const [tab, setTab] = useState<CategoryDetailsTab>('overview');

  useEffect(() => {
    if (categoryId !== null) setTab('overview');
  }, [categoryId]);

  const open = categoryId !== null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={category?.name ?? 'Направление'}
      description={category !== undefined ? undefined : undefined}
      size="lg"
      headerActions={
        category !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium"
              role="status"
              aria-label={`Статус: ${category.isActive ? 'Активно' : 'Неактивно'}`}
            >
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${category.isActive ? 'bg-success' : 'bg-ink-disabled'}`} />
              <span className={category.isActive ? 'text-success' : 'text-ink-muted'}>{category.isActive ? 'Активно' : 'Неактивно'}</span>
            </span>
            <CategoryActionMenu
              category={category}
              context="drawer"
              canManage={canManage}
              onEdit={() => { onEdit(category); }}
              onAssignLead={() => { onAssignLead(category); }}
              onChangeLead={() => { onChangeLead(category); }}
              onActivate={() => { onActivate(category); }}
              onDeactivate={() => { onDeactivate(category); }}
            />
          </div>
        ) : undefined
      }
    >
      {categoryId === null ? null : category === undefined ? (
        <ErrorState title="Направление не найдено" error={null} />
      ) : (
        <div className="space-y-5">
          <div role="tablist" aria-label="Разделы направления" className="flex gap-1 rounded-control bg-surface-muted p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => { setTab(item.id); }}
                className={`h-8 flex-1 rounded-control-sm text-[12.5px] font-medium transition ${tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'overview' ? <CategoryOverviewSection category={category} canManage={canManage} onAssignLead={() => { onAssignLead(category); }} /> : null}
            {tab === 'people' ? (
              <CategoryPeopleSection category={category} canManage={canManage} onOpenUser={onOpenUser} onChangeLead={() => { onChangeLead(category); }} />
            ) : null}
            {tab === 'settings' ? <CategorySettingsSection category={category} canManage={canManage} onEdit={() => { onEdit(category); }} /> : null}
            {tab === 'activity' ? <CategoryActivitySection category={category} /> : null}
          </div>
        </div>
      )}
    </Drawer>
  );
}
