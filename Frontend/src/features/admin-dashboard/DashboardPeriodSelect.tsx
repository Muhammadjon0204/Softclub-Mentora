import { Check, ChevronDown } from 'lucide-react';

import { Popover } from '../../shared/ui/Popover';
import { DASHBOARD_PERIOD_OPTIONS, type DashboardPeriod } from './dashboardPeriod';

interface DashboardPeriodSelectProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

/**
 * Заменяет calendar date-range picker (раздел 3 полироли) — Dashboard не
 * нуждается в произвольном выборе двух дат, только в грубом аналитическом
 * окне. Кастомный dropdown (не нативный `<select>`), потому что нужен
 * check-icon у активного пункта и primary-soft подсветка строки — этого
 * нативным select не добиться.
 */
export function DashboardPeriodSelect({ value, onChange }: DashboardPeriodSelectProps): JSX.Element {
  const current = DASHBOARD_PERIOD_OPTIONS.find((option) => option.value === value) ?? DASHBOARD_PERIOD_OPTIONS[1];

  return (
    <Popover
      align="right"
      panelClassName="w-[220px] rounded-[12px] p-1.5 shadow-popover"
      trigger={({ onClick, ref, isOpen }) => (
        <button
          type="button"
          ref={ref}
          onClick={onClick}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Период аналитики"
          className="flex h-10 w-[210px] shrink-0 items-center justify-between gap-2 rounded-[11px] border border-line bg-surface px-3 text-[13px] text-ink transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="truncate font-medium">{current?.label}</span>
          <ChevronDown
            className={`h-[15px] w-[15px] shrink-0 text-ink-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {(close) => (
        <div role="listbox" aria-label="Период аналитики" className="flex flex-col gap-0.5">
          {DASHBOARD_PERIOD_OPTIONS.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
                className={`flex h-[38px] shrink-0 items-center justify-between rounded-[8px] px-2.5 text-left text-[13px] transition-colors ${
                  isActive ? 'bg-brand-soft font-medium text-brand' : 'text-ink-secondary hover:bg-surface-hover'
                }`}
              >
                {option.label}
                {isActive ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
