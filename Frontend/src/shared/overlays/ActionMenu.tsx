import { cloneElement, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react';

import type { FloatingAlign, FloatingPlacement } from './floatingPosition';
import { Popover } from './Popover';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  /** Готовый trigger-элемент (например, `<IconButton>…</IconButton>`) — ref/onClick/aria-* добавляются автоматически. */
  trigger: ReactElement;
  items: ActionMenuItem[];
  placement?: FloatingPlacement;
  align?: FloatingAlign | 'left' | 'right';
  panelClassName?: string;
  ariaLabel?: string;
}

function enabledIndices(items: ActionMenuItem[]): number[] {
  return items.reduce<number[]>((acc, item, index) => {
    if (!item.disabled) acc.push(index);
    return acc;
  }, []);
}

/**
 * Меню действий (`…`, table row actions, profile actions) поверх Popover:
 * roving keyboard navigation (Arrow/Home/End), disabled-пункты пропускаются
 * стрелками, Tab закрывает меню и продолжает обычную навигацию (раздел 18 промпта).
 */
export function ActionMenu({ trigger, items, placement = 'bottom', align = 'end', panelClassName = '', ariaLabel = 'Действия' }: ActionMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Popover монтирует панель через portal на один render позже, чем `open` становится true —
  // requestAnimationFrame недостаточно надёжен, поэтому фокус выставляется из ref-callback
  // первого пункта, сработавшего именно тогда, когда его DOM-узел реально появился.
  const shouldFocusFirstRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      shouldFocusFirstRef.current = false;
      return;
    }
    shouldFocusFirstRef.current = enabledIndices(items).length > 0;
  }, [open, items]);

  function focusAt(index: number): void {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, close: () => void): void {
    const enabled = enabledIndices(items);
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
      onOpenChange={setOpen}
      placement={placement}
      align={align}
      panelClassName={`min-w-[200px] rounded-dropdown p-1.5 shadow-popover ${panelClassName}`}
      trigger={({ ref, isOpen }) =>
        cloneElement(trigger, {
          ref,
          onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            setOpen(!isOpen);
          },
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen,
        })
      }
    >
      {(close) => (
        <div role="menu" aria-label={ariaLabel} onKeyDown={(event) => { handleKeyDown(event, close); }} className="flex flex-col gap-0.5">
          {items.map((item, index) => (
            <ActionMenuRow
              key={item.id}
              item={item}
              onRef={(node) => {
                itemRefs.current[index] = node;
                if (node !== null && shouldFocusFirstRef.current && index === enabledIndices(items)[0]) {
                  shouldFocusFirstRef.current = false;
                  node.focus();
                  setActiveIndex(index);
                }
              }}
              onSelect={() => {
                close();
                item.onSelect();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}

function ActionMenuRow({
  item,
  onRef,
  onSelect,
}: {
  item: ActionMenuItem;
  onRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
}): JSX.Element {
  return (
    <>
      {item.separatorBefore === true ? <div role="separator" aria-orientation="horizontal" className="my-1 border-t border-divider" /> : null}
      <button
        ref={onRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={item.disabled}
        aria-disabled={item.disabled}
        onClick={onSelect}
        className={`flex h-[37px] w-full items-center gap-2.5 rounded-control-sm px-2.5 text-left text-[13px] transition focus-visible:outline-none focus:outline-none ${
          item.disabled === true
            ? 'cursor-not-allowed text-ink-disabled'
            : item.destructive === true
              ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft'
              : 'text-ink hover:bg-surface-hover focus:bg-surface-hover'
        }`}
      >
        {item.icon !== undefined ? (
          <span aria-hidden="true" className="flex h-[15px] w-[15px] shrink-0 items-center">
            {item.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.shortcut !== undefined ? <span aria-hidden="true" className="shrink-0 text-[11px] text-ink-muted">{item.shortcut}</span> : null}
      </button>
    </>
  );
}
