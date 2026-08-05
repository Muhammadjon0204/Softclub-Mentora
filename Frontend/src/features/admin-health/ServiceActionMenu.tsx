import { Eye, History, MoreHorizontal } from 'lucide-react';

import { ActionMenu } from '../../shared/overlays';
import type { ActionMenuItem } from '../../shared/overlays';
import { IconButton } from '../../shared/ui/Button';
import type { PreviewServiceDetails } from './healthPresentation';

export interface ServiceActionMenuProps {
  service: PreviewServiceDetails;
  context: 'card' | 'drawer';
  onOpenDetails?: () => void;
  onOpenIncidents: () => void;
}

/**
 * Раздел 40 промпта: Открыть; История инцидентов. «Проверить снова» не создаём —
 * ручного recheck в текущем UI не было (раздел 24 промпта: только если уже предусмотрен).
 */
export function ServiceActionMenu({ service, context, onOpenDetails, onOpenIncidents }: ServiceActionMenuProps): JSX.Element {
  const items: ActionMenuItem[] = [];

  if (context === 'card' && onOpenDetails !== undefined) {
    items.push({ id: 'open', label: 'Открыть', icon: <Eye className="h-full w-full" aria-hidden="true" />, onSelect: onOpenDetails });
  }
  items.push({ id: 'incidents', label: 'История инцидентов', icon: <History className="h-full w-full" aria-hidden="true" />, onSelect: onOpenIncidents });

  return (
    <ActionMenu
      align="end"
      ariaLabel={`Действия: ${service.name}`}
      panelClassName="w-56"
      trigger={
        <IconButton label={`Действия: ${service.name}`} size="sm">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
    />
  );
}
