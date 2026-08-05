import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconButton } from '../ui/Button';

interface DrawerHeaderProps {
  titleId: string;
  descriptionId?: string;
  title: string;
  description?: string;
  headerActions?: ReactNode;
  onClose?: () => void;
}

/** Верхняя часть Drawer: заголовок, описание, произвольные actions и кнопка закрытия. */
export function DrawerHeader({ titleId, descriptionId, title, description, headerActions, onClose }: DrawerHeaderProps): JSX.Element {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-divider px-5 py-5 sm:px-6">
      <div className="min-w-0">
        <h2 id={titleId} className="truncate text-[17px] font-semibold leading-[24px] text-ink">
          {title}
        </h2>
        {description !== undefined ? (
          <p id={descriptionId} className="mt-1 text-[13px] leading-[19px] text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {headerActions}
        {onClose !== undefined ? (
          <IconButton label="Закрыть" size="sm" onClick={onClose}>
            <X className="h-[17px] w-[17px]" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}
