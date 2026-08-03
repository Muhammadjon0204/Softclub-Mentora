import { Building2 } from 'lucide-react';

import { useBranchContext } from './useBranchContext';

/**
 * Неизменяемый badge филиала для Branch Admin, Lead и Mentor (ТЗ 2.2, раздел 24.8).
 * У этих ролей selector отсутствует полностью — не «скрыт», а не рендерится
 * вовсе, чтобы даже разработчик, читающий DOM, не нашёл в нём точку подмены филиала.
 */
export function BranchContextBadge(): JSX.Element | null {
  const { canOverrideBranch, fixedBranch } = useBranchContext();

  if (canOverrideBranch || fixedBranch === null) return null;

  return (
    <div className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface-muted px-3 text-sm font-medium text-ink">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink-muted">
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="truncate">{fixedBranch.name}</span>
      {fixedBranch.isHeadOffice ? (
        <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
          Главный офис
        </span>
      ) : null}
    </div>
  );
}
