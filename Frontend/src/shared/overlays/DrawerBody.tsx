import type { ReactNode } from 'react';

/** Прокручиваемая часть Drawer — только она скроллится, не вся страница. */
export function DrawerBody({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>;
}
