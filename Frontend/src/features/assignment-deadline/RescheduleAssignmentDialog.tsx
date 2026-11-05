import { ArrowRight, CalendarClock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { DatePicker } from '../../shared/ui/DatePicker';
import { Notice } from '../../shared/ui/DetailBlocks';
import { FormField, FormTextarea } from '../../shared/ui/FormField';
import { TimePicker } from '../../shared/ui/TimePicker';
import { todayKey } from '../../lib/dayKeys';
import { formatCategoryDateTime, localInputToUtcMs, toDateInputValue, toTimeInputValue } from '../lead/scope/leadDateFormat';
import { pluralizeRu } from '../admin-assignments/assignmentPresentation';

const DAY_MS = 86_400_000;
const REASON_MIN = 5;
const REASON_MAX = 500;

/** Сдвиг обычно считают от срока, а не от календаря: «ещё три дня», а не «четырнадцатое». */
const SHIFTS = [
  { label: '+1 день', days: 1 },
  { label: '+3 дня', days: 3 },
  { label: '+1 неделя', days: 7 },
] as const;

export interface RescheduleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentTitle: string;
  currentDueAtMs: number;
  isOverdue: boolean;
  timeZoneId: string;
  /** Вызывающий показывает тост. Диалог закрывается только при успехе, иначе введённое не пропадёт. */
  onConfirm: (dueAtMs: number, reason: string) => Promise<void>;
}

function shiftLabel(diffMs: number): string {
  const days = Math.round(Math.abs(diffMs) / DAY_MS);
  const direction = diffMs > 0 ? 'позже' : 'раньше';
  if (days === 0) return diffMs > 0 ? 'чуть позже' : 'чуть раньше';
  return `на ${String(days)} ${pluralizeRu(days, 'день', 'дня', 'дней')} ${direction}`;
}

/**
 * Смена срока опубликованного задания. Главное здесь — что станет после сохранения: прежний и новый
 * срок стоят рядом, а причина обязательна, потому что исполнитель получит её в уведомлении.
 */
export function RescheduleAssignmentDialog({
  open,
  onOpenChange,
  assignmentTitle,
  currentDueAtMs,
  isOverdue,
  timeZoneId,
  onConfirm,
}: RescheduleAssignmentDialogProps): JSX.Element {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(toDateInputValue(currentDueAtMs, timeZoneId));
    setTime(toTimeInputValue(currentDueAtMs, timeZoneId));
    setReason('');
  }, [open, currentDueAtMs, timeZoneId]);

  const nextDueMs = useMemo(() => localInputToUtcMs(date, time, timeZoneId), [date, time, timeZoneId]);
  const changed = nextDueMs !== null && nextDueMs !== currentDueAtMs;
  const inFuture = nextDueMs !== null && nextDueMs > Date.now();
  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length >= REASON_MIN && trimmedReason.length <= REASON_MAX;
  const canSave = changed && inFuture && reasonValid && !busy;

  function applyShift(days: number): void {
    // Просроченное двигаем от сегодня: прибавлять дни к прошлому значило бы снова дать прошлую дату.
    const base = Math.max(currentDueAtMs, Date.now());
    const next = base + days * DAY_MS;
    setDate(toDateInputValue(next, timeZoneId));
    setTime(toTimeInputValue(next, timeZoneId));
  }

  async function handleSave(): Promise<void> {
    if (nextDueMs === null || !canSave) return;
    setBusy(true);
    try {
      await onConfirm(nextDueMs, trimmedReason);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Изменить срок"
      description={`«${assignmentTitle}»`}
      preventClose={busy}
      icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { onOpenChange(false); }}>Отмена</Button>
          <Button variant="primary" isLoading={busy} disabled={!canSave} onClick={() => { void handleSave(); }}>Изменить срок</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-control border border-line bg-surface-muted px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11.5px] text-ink-muted">Сейчас</p>
            <p className="truncate text-[13px] font-medium tabular-nums text-ink-secondary">{formatCategoryDateTime(currentDueAtMs, timeZoneId).split(' (')[0]}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-disabled" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11.5px] text-ink-muted">{changed && nextDueMs !== null ? shiftLabel(nextDueMs - currentDueAtMs) : 'Новый срок'}</p>
            <p className={`truncate text-[13px] font-semibold tabular-nums ${changed && inFuture ? 'text-brand' : 'text-ink-disabled'}`}>
              {nextDueMs !== null ? formatCategoryDateTime(nextDueMs, timeZoneId).split(' (')[0] : '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрый сдвиг срока">
          {SHIFTS.map((shift) => (
            <button
              key={shift.days}
              type="button"
              onClick={() => { applyShift(shift.days); }}
              className="h-8 rounded-control-sm border border-line bg-surface px-3 text-[12.5px] font-medium tabular-nums text-ink-secondary transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {shift.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <FormField
            label="Дата"
            htmlFor="reschedule-date"
            required
            error={nextDueMs !== null && !inFuture ? 'Срок должен быть в будущем' : undefined}
            hint={`Часовой пояс: ${timeZoneId}`}
          >
            <DatePicker id="reschedule-date" value={date} onChange={setDate} min={todayKey()} invalid={nextDueMs !== null && !inFuture} />
          </FormField>
          <FormField label="Время" htmlFor="reschedule-time" required>
            <TimePicker id="reschedule-time" value={time} onChange={setTime} />
          </FormField>
        </div>

        <FormField label="Причина" htmlFor="reschedule-reason" required hint="Исполнитель увидит её в уведомлении и в истории задания">
          <FormTextarea
            id="reschedule-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={(event) => { setReason(event.target.value); }}
            placeholder="Например: перенесли занятие на следующую неделю"
          />
        </FormField>

        {isOverdue ? (
          <Notice tone="warning" icon={CalendarClock} title="Задание вернётся в работу">
            Просрочка останется в статистике: новый срок её не стирает.
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}
