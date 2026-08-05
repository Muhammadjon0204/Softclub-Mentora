import { CalendarClock } from 'lucide-react';

import { Modal } from '../../shared/overlays';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { DeadlineChangeEntry } from './assignmentPresentation';

export interface DeadlineHistoryModalProps {
  entries: DeadlineChangeEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only — Admin не меняет дедлайн в этом workflow (раздел 19 промпта). */
export function DeadlineHistoryModal({ entries, open, onOpenChange }: DeadlineHistoryModalProps): JSX.Element {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="История изменений дедлайна" size="md">
      {entries.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />} title="Дедлайн не изменялся" description="Изменения появятся здесь, если Lead продлит срок после возврата на доработку." />
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-control border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink-muted line-through">{entry.fromLabel}</span>
                <span aria-hidden="true" className="text-ink-disabled">→</span>
                <span className="font-semibold text-ink">{entry.toLabel}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-secondary">{entry.reason}</p>
              <p className="mt-1.5 text-[11.5px] text-ink-muted">{entry.changedByName} · {entry.changedAtLabel}</p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
