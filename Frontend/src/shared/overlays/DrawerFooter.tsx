import type { ReactNode } from 'react';

/** Нижняя часть Drawer — кнопки действий, прижатые вниз и растягиваемые на mobile. */
export function DrawerFooter({ children }: { children: ReactNode }): JSX.Element {
  return <div className="shrink-0 border-t border-divider bg-surface-muted px-5 py-4 sm:px-6">{children}</div>;
}
