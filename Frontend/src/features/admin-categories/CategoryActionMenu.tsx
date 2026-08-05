import { Eye, MoreHorizontal, Pencil, Power, UserCog, UserPlus } from 'lucide-react';

import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';
import { IconButton } from '../../shared/ui/Button';
import type { PreviewCategoryDetails } from './categoryPresentation';

export interface CategoryActionMenuProps {
  category: PreviewCategoryDetails;
  context: 'card' | 'drawer';
  canManage: boolean;
  onOpenDetails?: () => void;
  onEdit: () => void;
  onAssignLead: () => void;
  onChangeLead: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}

/** Раздел 40 промпта — только Открыть/Редактировать/Lead/Активировать-Деактивировать. */
export function CategoryActionMenu({ category, context, canManage, onOpenDetails, onEdit, onAssignLead, onChangeLead, onActivate, onDeactivate }: CategoryActionMenuProps): JSX.Element {
  const items: ActionMenuItem[] = [];

  if (context === 'card' && onOpenDetails !== undefined) {
    items.push({ id: 'open', label: 'Открыть', icon: <Eye className="h-full w-full" aria-hidden="true" />, onSelect: onOpenDetails });
  }

  if (canManage) {
    items.push({ id: 'edit', label: 'Редактировать', icon: <Pencil className="h-full w-full" aria-hidden="true" />, onSelect: onEdit });

    if (category.leadUserId === null) {
      items.push({ id: 'assign-lead', label: 'Назначить руководителя', icon: <UserPlus className="h-full w-full" aria-hidden="true" />, onSelect: onAssignLead });
    } else {
      items.push({ id: 'change-lead', label: 'Сменить руководителя', icon: <UserCog className="h-full w-full" aria-hidden="true" />, onSelect: onChangeLead });
    }

    items.push({
      id: 'toggle-active',
      label: category.isActive ? 'Деактивировать' : 'Активировать',
      icon: <Power className="h-full w-full" aria-hidden="true" />,
      destructive: category.isActive,
      separatorBefore: true,
      onSelect: category.isActive ? onDeactivate : onActivate,
    });
  }

  if (items.length === 0) return <span className="inline-block h-8 w-8" aria-hidden="true" />;

  return (
    <ActionMenu
      align="end"
      ariaLabel={`Действия: ${category.name}`}
      panelClassName="w-60"
      trigger={
        <IconButton label={`Действия: ${category.name}`} size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
    />
  );
}
