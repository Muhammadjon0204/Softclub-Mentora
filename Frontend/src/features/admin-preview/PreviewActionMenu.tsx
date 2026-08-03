import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { MenuItem, Popover } from '../../shared/ui/Popover';

export interface PreviewActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

/** Компактное overflow-меню строки таблицы — поверх уже существующего примитива Popover/MenuItem. */
export function PreviewActionMenu({ items }: { items: PreviewActionMenuItem[] }): JSX.Element {
  return (
    <Popover
      align="right"
      panelClassName="w-56 rounded-dropdown p-1.5 shadow-popover"
      trigger={({ onClick, ref, isOpen }) => (
        <button
          type="button"
          ref={ref}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Действия"
          className="flex h-8 w-8 items-center justify-center rounded-control-sm text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <MenuItem
              key={item.label}
              icon={item.icon}
              destructive={item.destructive}
              onClick={() => {
                close();
                item.onClick();
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
