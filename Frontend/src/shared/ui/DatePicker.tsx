import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { addDaysToKey as addDays, formatDayKeyRu, todayKey } from '../../lib/dayKeys';
import {
  MONTH_NAMES_RU,
  WEEKDAY_SHORT_RU,
  monthGrid,
  parseDayKey,
  shiftMonth,
  toDayKey,
  type YearMonth,
} from '../../lib/calendarMath';
import { Popover } from '../overlays';

export interface DatePickerProps {
  id?: string;
  /** `YYYY-MM-DD` или пустая строка. */
  value: string;
  onChange: (value: string) => void;
  /** Самая ранняя доступная дата, `YYYY-MM-DD`. */
  min?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Быстрый выбор: «Сегодня», «Завтра», «Через неделю». */
  showPresets?: boolean;
  /** Показать крестик очистки (для необязательных дат). */
  clearable?: boolean;
}

/**
 * Выбор даты вместо нативного `<input type="date">`: тот выглядит по-разному в каждом браузере,
 * показывает американский `mm/dd/yyyy` и неделю с воскресенья. Здесь — русские названия,
 * неделя с понедельника, крупные клетки, «Сегодня/Завтра/Через неделю» в один клик и управление
 * с клавиатуры (стрелки, Enter, PageUp/PageDown — месяц).
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  invalid,
  disabled,
  placeholder = 'Выберите дату',
  showPresets = true,
  clearable = false,
}: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const initial = value !== '' ? value : (min !== undefined && min > today ? min : today);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      align="start"
      panelClassName="w-[300px] rounded-dropdown p-3 shadow-popover"
      trigger={({ ref, onClick, isOpen }) => (
        <div className="relative">
          <button
            ref={ref}
            id={id}
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-invalid={invalid === true ? true : undefined}
            className={[
              'flex h-10 w-full items-center gap-2.5 rounded-control border bg-surface px-3 text-left text-[13px] outline-none transition',
              'hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled',
              invalid === true ? 'border-danger' : isOpen ? 'border-brand' : 'border-line',
            ].join(' ')}
          >
            <CalendarDays className={`h-4 w-4 shrink-0 ${value !== '' ? 'text-brand' : 'text-ink-muted'}`} aria-hidden="true" />
            <span className={`min-w-0 flex-1 truncate ${value !== '' ? 'text-ink' : 'text-ink-disabled'}`}>
              {value !== '' ? formatDayKeyRu(value) : placeholder}
            </span>
          </button>
          {clearable && value !== '' && disabled !== true ? (
            <button
              type="button"
              onClick={() => { onChange(''); }}
              aria-label="Очистить дату"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition hover:bg-surface-hover hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}
    >
      {(close) => (
        <CalendarPanel
          key={initial}
          initial={initial}
          selected={value}
          today={today}
          min={min}
          showPresets={showPresets}
          onPick={(next) => { onChange(next); close(); }}
        />
      )}
    </Popover>
  );
}

function CalendarPanel({
  initial,
  selected,
  today,
  min,
  showPresets,
  onPick,
}: {
  initial: string;
  selected: string;
  today: string;
  min?: string;
  showPresets: boolean;
  onPick: (key: string) => void;
}): JSX.Element {
  const start = parseDayKey(initial);
  const [visible, setVisible] = useState<YearMonth>({ year: start.year, month: start.month });
  const [focused, setFocused] = useState(initial);
  const gridRef = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => monthGrid(visible.year, visible.month), [visible]);

  const isDisabled = (key: string): boolean => min !== undefined && key < min;

  // Клавиатурный фокус ведёт за собой видимый месяц.
  useEffect(() => {
    const { year, month } = parseDayKey(focused);
    if (year !== visible.year || month !== visible.month) setVisible({ year, month });
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focused}"]`)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при смене фокуса
  }, [focused]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      setFocused(addDays(focused, moves[event.key]));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const { year, month, day } = parseDayKey(focused);
      const target = shiftMonth({ year, month }, event.key === 'PageUp' ? -1 : 1);
      const lastDay = new Date(Date.UTC(target.year, target.month, 0)).getUTCDate();
      setFocused(toDayKey(target.year, target.month, Math.min(day, lastDay)));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isDisabled(focused)) onPick(focused);
    }
  }

  const presets = [
    { label: 'Сегодня', key: today },
    { label: 'Завтра', key: addDays(today, 1) },
    { label: 'Через неделю', key: addDays(today, 7) },
  ].filter((preset) => !isDisabled(preset.key));

  return (
    <div role="dialog" aria-label="Выбор даты">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[14px] font-semibold text-ink">
          {MONTH_NAMES_RU[visible.month - 1]} <span className="font-normal text-ink-muted">{visible.year}</span>
        </p>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => { setVisible((v) => shiftMonth(v, -1)); }} className="grid h-8 w-8 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Следующий месяц" onClick={() => { setVisible((v) => shiftMonth(v, 1)); }} className="grid h-8 w-8 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover hover:text-ink">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAY_SHORT_RU.map((label, index) => (
          <span key={label} className={`py-1 text-center text-[10.5px] font-semibold uppercase tracking-wide ${index >= 5 ? 'text-ink-disabled' : 'text-ink-muted'}`}>
            {label}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="grid" onKeyDown={onKeyDown} className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const disabled = isDisabled(cell.key);
          const isSelected = cell.key === selected;
          const isToday = cell.key === today;
          return (
            <button
              key={cell.key}
              type="button"
              data-key={cell.key}
              role="gridcell"
              tabIndex={cell.key === focused ? 0 : -1}
              disabled={disabled}
              aria-selected={isSelected}
              aria-label={formatDayKeyRu(cell.key)}
              onClick={() => { onPick(cell.key); }}
              className={[
                'relative grid h-9 place-items-center rounded-control-sm text-[13px] tabular-nums outline-none transition',
                'focus-visible:ring-2 focus-visible:ring-brand',
                disabled
                  ? 'cursor-not-allowed text-ink-disabled opacity-40'
                  : isSelected
                    ? 'bg-brand font-semibold text-white shadow-[0_4px_12px_-6px_var(--primary)]'
                    : `hover:bg-brand-soft hover:text-brand-active ${cell.inMonth ? (cell.weekday >= 5 ? 'text-ink-muted' : 'text-ink') : 'text-ink-disabled'}`,
              ].join(' ')}
            >
              {cell.day}
              {isToday && !isSelected ? <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" /> : null}
            </button>
          );
        })}
      </div>

      {showPresets && presets.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-divider pt-3">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => { onPick(preset.key); }}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${preset.key === selected ? 'border-brand bg-brand-soft text-brand-active' : 'border-line text-ink-secondary hover:border-brand hover:text-brand'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
