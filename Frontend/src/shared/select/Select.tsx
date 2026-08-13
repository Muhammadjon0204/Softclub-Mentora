import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { Popover } from '../overlays';
import { SelectEmptyState, SelectOptionRow } from './SelectOptionRow';
import { SelectTrigger } from './SelectTrigger';
import type { SelectOption } from './selectTypes';

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
  panelClassName?: string;
  emptyMessage?: string;
  /** См. `SelectTrigger` — `false` для compact filter-toolbar select'ов. */
  fullWidth?: boolean;
}

function enabledIndices(options: SelectOption[]): number[] {
  return options.reduce<number[]>((acc, option, index) => {
    if (option.disabled !== true) acc.push(index);
    return acc;
  }, []);
}

/**
 * Кастомный `<select>` для небольших статичных списков (раздел 4 промпта):
 * роли, статусы, язык, период, timezone, формат экспорта. Построен на общем
 * `Popover` (portal, overlay stack, topmost Escape, focus return, flip/clamp) —
 * второй overlay-системы здесь нет. `ref` указывает на trigger-кнопку, чтобы
 * `react-hook-form` мог вызвать `setFocus()` на невалидном поле.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    onValueChange,
    options,
    placeholder = 'Выберите значение',
    disabled = false,
    invalid = false,
    id,
    name,
    onBlur,
    ariaLabel,
    size = 'md',
    className = '',
    panelClassName = '',
    emptyMessage,
    fullWidth = true,
  },
  forwardedRef,
) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldFocusRef = useRef<'selected' | 'first' | null>(null);

  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    setPanelWidth(triggerElRef.current?.getBoundingClientRect().width ?? null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const enabled = enabledIndices(options);
    const selectedIndex = options.findIndex((option) => option.value === value);
    const initial = selectedIndex !== -1 && !options[selectedIndex].disabled ? selectedIndex : (enabled[0] ?? -1);
    setActiveIndex(initial);
    shouldFocusRef.current = initial !== -1 ? 'selected' : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчитываем только при открытии, не на каждое изменение options/value
  }, [open]);

  function focusAt(index: number): void {
    setActiveIndex(index);
    optionRefs.current[index]?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, close: () => void): void {
    const enabled = enabledIndices(options);
    if (enabled.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const pos = enabled.indexOf(activeIndex);
      focusAt(pos === -1 || pos === enabled.length - 1 ? enabled[0] : enabled[pos + 1]);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const pos = enabled.indexOf(activeIndex);
      focusAt(pos <= 0 ? enabled[enabled.length - 1] : enabled[pos - 1]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(enabled[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(enabled[enabled.length - 1]);
    } else if (event.key === 'Tab') {
      close();
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
      panelClassName={`rounded-dropdown p-1.5 shadow-popover ${panelClassName}`}
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
          fullWidth={fullWidth}
        />
      )}
    >
      {(close) => (
        <div
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={(event) => { handleKeyDown(event, close); }}
          style={{ width: panelWidth !== null ? Math.max(panelWidth, 180) : undefined }}
          className="flex max-h-72 flex-col gap-0.5 overflow-y-auto"
        >
          {options.length === 0 ? (
            <SelectEmptyState message={emptyMessage} />
          ) : (
            options.map((option, index) => (
              <SelectOptionRow
                key={option.value}
                option={option}
                isSelected={option.value === value}
                isActive={index === activeIndex}
                onRef={(node) => {
                  optionRefs.current[index] = node;
                  if (node !== null && shouldFocusRef.current !== null && index === activeIndex) {
                    shouldFocusRef.current = null;
                    node.focus();
                  }
                }}
                onSelect={() => {
                  onValueChange(option.value);
                  close();
                }}
              />
            ))
          )}
        </div>
      )}
    </Popover>
  );
});
