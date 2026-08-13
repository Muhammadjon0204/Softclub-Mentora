import { Tags } from 'lucide-react';

import { useLeadScope } from '../../features/lead/scope/useLeadScope';

/**
 * Read-only индикатор рабочего пространства Lead: Category · Branch. НЕ
 * dropdown — Lead не выбирает ни Branch, ни Category (ТЗ 2.2, раздел 8.3:
 * ровно одна активная Category одного Branch). Аналог `BranchContextBadge`
 * для второго уровня изоляции (раздел 9/40 задачи Phase 3): собственный
 * компонент, а не модификация `BranchContextBadge`, чтобы не трогать
 * поведение, которое уже используется Branch Admin (Phase 2).
 */
export function LeadWorkspaceBadge(): JSX.Element {
  const scope = useLeadScope();

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
