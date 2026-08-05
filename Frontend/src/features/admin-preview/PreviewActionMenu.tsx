import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '../../shared/ui/Button';
import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';

export interface PreviewActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

/** Компактное overflow-меню строки таблицы — поверх общего `ActionMenu` из shared overlay system. */
export function PreviewActionMenu({ items }: { items: PreviewActionMenuItem[] }): JSX.Element {
  const menuItems: ActionMenuItem[] = items.map((item, index) => ({
    id: `${index}-${item.label}`,
    label: item.label,
    icon: item.icon,
    destructive: item.destructive,
    onSelect: item.onClick,
  }));

  return (
    <ActionMenu
      align="end"
      ariaLabel="Действия"
      panelClassName="w-56"
      trigger={
        <IconButton label="Действия" size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={menuItems}
    />
  );
}
