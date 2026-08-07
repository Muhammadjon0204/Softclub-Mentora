import { Search } from 'lucide-react';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { Popover } from '../overlays';
import { SelectEmptyState, SelectOptionRow } from './SelectOptionRow';
import { SelectTrigger } from './SelectTrigger';
import type { SelectOption } from './selectTypes';

export interface SearchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
  panelClassName?: string;
}

function enabledIndices(options: SelectOption[]): number[] {
  return options.reduce<number[]>((acc, option, index) => {
    if (option.disabled !== true) acc.push(index);
    return acc;
  }, []);
}

/**
 * Селектор с поиском в реальном времени для больших списков (раздел 4 промпта:
 * Branch/Lead/Admin-кандидаты, длинные списки пользователей). Тот же `Popover`,
 * что и у `Select` — отличие только в том, что фокус остаётся в поле поиска, а
 * стрелки двигают подсветку по состоянию, а не по DOM-фокусу пунктов.
 */
export const SearchSelect = forwardRef<HTMLButtonElement, SearchSelectProps>(function SearchSelect(
  {
    value,
    onValueChange,
    options,
    placeholder = 'Выберите значение',
    searchPlaceholder = 'Поиск…',
    emptyMessage = 'Ничего не найдено',
    disabled = false,
    invalid = false,
    id,
    name,
    onBlur,
    ariaLabel,
    size = 'md',
    className = '',
    panelClassName = '',
  },
  forwardedRef,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(normalized) || (option.description?.toLowerCase().includes(normalized) ?? false),
    );
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) return;
    setPanelWidth(triggerElRef.current?.getBoundingClientRect().width ?? null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(enabledIndices(filtered)[0] ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сбрасываем подсветку именно при смене query/filtered
  }, [query]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, close: () => void): void {
    const enabled = enabledIndices(filtered);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (enabled.length === 0) return;
      const pos = enabled.indexOf(activeIndex);
      setActiveIndex(pos === -1 || pos === enabled.length - 1 ? enabled[0] : enabled[pos + 1]);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (enabled.length === 0) return;
      const pos = enabled.indexOf(activeIndex);
      setActiveIndex(pos <= 0 ? enabled[enabled.length - 1] : enabled[pos - 1]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option !== undefined && option.disabled !== true) {
        onValueChange(option.value);
        close();
      }
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
      panelClassName={`rounded-dropdown p-0 shadow-popover ${panelClassName}`}
      trigger={({ ref, onClick, isOpen }) => (
        <SelectTrigger
          triggerRef={(node) => {
            ref(node);
            triggerElRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef !== null) forwardedRef.current = node;
          }}
          label={selected?.label ?? placeholder}
          showPlaceholder={selected === undefined}
          isOpen={isOpen}
          disabled={disabled}
          invalid={invalid}
          size={size}
          id={id}
          name={name}
          ariaLabel={ariaLabel}
          onClick={onClick}
          className={className}
        />
      )}
    >
      {(close) => (
        <div style={{ width: panelWidth !== null ? Math.max(panelWidth, 260) : 260 }}>
          <div className="border-b border-divider p-2">
            <div className="flex items-center gap-2 rounded-control-sm border border-line bg-surface-muted px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                onKeyDown={(event) => { handleKeyDown(event, close); }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-disabled"
              />
            </div>
          </div>

          <div role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <SelectEmptyState message={emptyMessage} />
            ) : (
              filtered.map((option, index) => (
                <SelectOptionRow
                  key={option.value}
                  option={option}
                  isSelected={option.value === value}
                  isActive={index === activeIndex}
                  onSelect={() => {
                    onValueChange(option.value);
                    close();
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </Popover>
  );
});
