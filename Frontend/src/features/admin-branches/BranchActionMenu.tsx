import { Eye, MoreHorizontal, Pencil, Power, UserCog, UserPlus } from 'lucide-react';

import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';
import { IconButton } from '../../shared/ui/Button';
import type { PreviewBranchDetails } from './branchPresentation';

export interface BranchActionMenuProps {
  branch: PreviewBranchDetails;
  context: 'row' | 'drawer';
  isOrgAdmin: boolean;
  onOpenDetails?: () => void;
  onEdit: () => void;
  onAssignAdmin: () => void;
  onChangeAdmin: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
}

/** Раздел 36 промпта: Branch Admin видит только «Открыть» — остальное скрыто, не disabled. */
export function BranchActionMenu({ branch, context, isOrgAdmin, onOpenDetails, onEdit, onAssignAdmin, onChangeAdmin, onActivate, onDeactivate }: BranchActionMenuProps): JSX.Element {
  const items: ActionMenuItem[] = [];

  if (context === 'row' && onOpenDetails !== undefined) {
    items.push({ id: 'open', label: 'Открыть', icon: <Eye className="h-full w-full" aria-hidden="true" />, onSelect: onOpenDetails });
  }

  if (isOrgAdmin) {
    items.push({ id: 'edit', label: 'Редактировать', icon: <Pencil className="h-full w-full" aria-hidden="true" />, onSelect: onEdit });

    if (branch.adminUserId === null) {
      items.push({ id: 'assign-admin', label: 'Назначить администратора', icon: <UserPlus className="h-full w-full" aria-hidden="true" />, onSelect: onAssignAdmin });
    } else {
      items.push({ id: 'change-admin', label: 'Сменить администратора', icon: <UserCog className="h-full w-full" aria-hidden="true" />, onSelect: onChangeAdmin });
    }

    items.push({
      id: 'toggle-active',
      label: branch.isActive ? 'Деактивировать' : 'Активировать',
      icon: <Power className="h-full w-full" aria-hidden="true" />,
      destructive: branch.isActive,
      separatorBefore: true,
      onSelect: branch.isActive ? onDeactivate : onActivate,
    });
  }

  if (items.length === 0) return <span className="inline-block h-8 w-8" aria-hidden="true" />;

  return (
    <ActionMenu
      align="end"
      ariaLabel={`Действия: ${branch.name}`}
      panelClassName="w-60"
      trigger={
        <IconButton label={`Действия: ${branch.name}`} size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
    />
  );
}
