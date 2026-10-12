import { Clock3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Popover } from '../overlays';

export interface TimePickerProps {
  id?: string;
  /** `HH:mm`, 24-часовой формат, или пустая строка. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PRESETS = ['09:00', '12:00', '14:00', '18:00', '21:00', '23:59'];

const pad = (n: number): string => String(n).padStart(2, '0');

function parse(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/**
 * Время в 24-часовом формате вместо нативного `<input type="time">` (тот в части браузеров
 * показывает `11:59 PM`). Сверху — частые варианты одной кнопкой, ниже — две колонки: часы и
 * минуты с шагом 5. Нестандартная минута (например, 23:59) остаётся выбранной и видна в списке.
 */
export function TimePicker({ id, value, onChange, invalid, disabled, placeholder = 'Время' }: TimePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const parsed = parse(value);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      align="start"
      panelClassName="w-[248px] rounded-dropdown p-3 shadow-popover"
      trigger={({ ref, onClick, isOpen }) => (
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
          <Clock3 className={`h-4 w-4 shrink-0 ${parsed !== null ? 'text-brand' : 'text-ink-muted'}`} aria-hidden="true" />
          <span className={`tabular-nums ${parsed !== null ? 'font-medium text-ink' : 'text-ink-disabled'}`}>
            {parsed !== null ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : placeholder}
          </span>
        </button>
      )}
    >
      {(close) => (
        <TimePanel
          hour={parsed?.hour ?? null}
          minute={parsed?.minute ?? null}
          onChange={onChange}
          onDone={close}
        />
      )}
    </Popover>
  );
}

function TimePanel({
  hour,
  minute,
  onChange,
  onDone,
}: {
  hour: number | null;
  minute: number | null;
  onChange: (value: string) => void;
  onDone: () => void;
}): JSX.Element {
  const [h, setH] = useState(hour ?? 23);
  const [m, setM] = useState(minute ?? 59);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const minuteOptions = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b);

  // Выбранные значения сразу видны, без прокрутки руками. Прокручиваем только саму колонку:
  // scrollIntoView сдвинул бы заодно Drawer и страницу под ним.
  useEffect(() => {
    for (const column of [hoursRef.current, minutesRef.current]) {
      const selected = column?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (column !== null && column !== undefined && selected !== null && selected !== undefined) {
        column.scrollTop = selected.offsetTop - column.clientHeight / 2 + selected.clientHeight / 2;
      }
    }
  }, []);

  const commit = (nextH: number, nextM: number): void => {
    setH(nextH);
    setM(nextM);
    onChange(`${pad(nextH)}:${pad(nextM)}`);
  };

  const column = 'relative h-44 overflow-y-auto overscroll-contain rounded-control-sm bg-surface-muted p-1 [scrollbar-width:thin]';
  const option = (active: boolean): string =>
    `block w-full rounded-md py-1.5 text-center text-[13px] tabular-nums transition ${active ? 'bg-brand font-semibold text-white' : 'text-ink hover:bg-brand-soft hover:text-brand-active'}`;

  return (
    <div role="dialog" aria-label="Выбор времени">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const active = preset === `${pad(h)}:${pad(m)}`;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => { const p = parse(preset); if (p !== null) { commit(p.hour, p.minute); onDone(); } }}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums transition ${active ? 'border-brand bg-brand-soft text-brand-active' : 'border-line text-ink-secondary hover:border-brand hover:text-brand'}`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">Часы</p>
          <div ref={hoursRef} role="listbox" aria-label="Часы" className={column}>
            {HOURS.map((value) => (
              <button key={value} type="button" role="option" aria-selected={value === h} onClick={() => { commit(value, m); }} className={option(value === h)}>
                {pad(value)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-center text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">Минуты</p>
          <div ref={minutesRef} role="listbox" aria-label="Минуты" className={column}>
            {minuteOptions.map((value) => (
              <button key={value} type="button" role="option" aria-selected={value === m} onClick={() => { commit(h, value); }} className={option(value === m)}>
                {pad(value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-divider pt-3">
        <span className="text-[18px] font-semibold tabular-nums text-ink">{pad(h)}:{pad(m)}</span>
        <button type="button" onClick={() => { commit(h, m); onDone(); }} className="rounded-full bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-hover">
          Готово
        </button>
      </div>
    </div>
  );
}
