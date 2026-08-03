import { Building2, Check, ChevronDown, Globe2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Popover } from '../../shared/ui/Popover';
import { useBranchContext } from './useBranchContext';

/**
 * Branch selector в topbar — виден только Organization Admin (ТЗ 2.2, раздел 24.8).
 * Branch Admin/Lead/Mentor вместо него видят `BranchContextBadge` без возможности
 * выбора: сам факт присутствия selector'а определяется `canOverrideBranch`,
 * а не ролевой проверкой в этом компоненте — источник истины один.
 */
export function BranchContextSelector(): JSX.Element | null {
  const { canOverrideBranch, selectedBranchId, availableBranches, isLoadingBranches, setSelectedBranch } =
    useBranchContext();
  const [query, setQuery] = useState('');

  const selectedBranch = availableBranches.find((branch) => branch.id === selectedBranchId) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return availableBranches;
    return availableBranches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(normalized) || branch.code.toLowerCase().includes(normalized),
    );
  }, [availableBranches, query]);

  if (!canOverrideBranch) return null;

  return (
    <Popover
      panelClassName="w-72 min-w-[220px] rounded-dropdown p-0 shadow-popover"
      trigger={({ onClick, ref, isOpen }) => (
        <button
          type="button"
          ref={ref}
          onClick={onClick}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={isLoadingBranches}
          className="flex h-10 min-w-[200px] items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            {selectedBranch === null ? (
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
          <span className="flex-1 truncate text-left">
            {selectedBranch === null ? 'Все филиалы' : selectedBranch.name}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div role="listbox" aria-label="Выбор филиала">
          <div className="border-b border-divider p-2">
            <div className="flex items-center gap-2 rounded-control-sm border border-line bg-surface-muted px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Поиск по филиалам…"
                className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-disabled"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            <BranchOption
              label="Все филиалы"
              description="Сводная аналитика организации"
              icon={<Globe2 className="h-4 w-4" aria-hidden="true" />}
              isSelected={selectedBranchId === null}
              onClick={() => {
                setSelectedBranch(null);
                close();
              }}
            />

            {filtered.map((branch) => (
              <BranchOption
                key={branch.id}
                label={branch.name}
                description={branch.code}
                isHeadOffice={branch.isHeadOffice}
                icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                isSelected={selectedBranchId === branch.id}
                onClick={() => {
                  setSelectedBranch(branch.id);
                  close();
                }}
              />
            ))}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-ink-muted">Ничего не найдено</p>
            ) : null}
          </div>
        </div>
      )}
    </Popover>
  );
}

interface BranchOptionProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  isHeadOffice?: boolean;
  onClick: () => void;
}

function BranchOption({ label, description, icon, isSelected, isHeadOffice, onClick }: BranchOptionProps): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-control-sm px-2.5 py-2 text-left transition hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none ${isSelected ? 'bg-brand-soft' : ''}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-white text-brand' : 'bg-surface-muted text-ink-muted'}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-[13px] font-medium ${isSelected ? 'text-brand' : 'text-ink'}`}>
            {label}
          </span>
          {isHeadOffice === true ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Главный офис
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[12px] text-ink-muted">{description}</span>
      </span>
      {isSelected ? <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> : null}
    </button>
  );
}
