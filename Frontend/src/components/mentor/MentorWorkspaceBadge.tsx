import { Tags } from 'lucide-react';

import { useMentorScope } from '../../features/mentor/scope/useMentorScope';

/**
 * Read-only индикатор рабочего пространства Mentor: Category · Branch —
 * аналог `LeadWorkspaceBadge`. Mentor не выбирает ни Branch, ни Category.
 */
export function MentorWorkspaceBadge(): JSX.Element {
  const scope = useMentorScope();

  return (
    <div
      className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 text-sm font-medium text-ink"
      title={`${scope.categoryName} · ${scope.branchDisplayName}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink-muted">
        <Tags className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="truncate">{scope.categoryName}</span>
      <span aria-hidden="true" className="text-ink-disabled">
        ·
      </span>
      <span className="truncate text-ink-secondary">{scope.branchDisplayName}</span>
    </div>
  );
}
