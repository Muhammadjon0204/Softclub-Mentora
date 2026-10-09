import { CalendarCheck2, CalendarClock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { AssignmentDto } from '../../api/lead/assignments';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';
import {
  MONTH_NAMES_GENITIVE_RU,
  MONTH_NAMES_RU,
  WEEKDAY_LONG_RU,
  WEEKDAY_SHORT_RU,
  dayKeyOf,
  formatTime,
  gridRangeUtc,
  monthGrid,
  parseDayKey,
  shiftMonth,
  weekdayOf,
  zonedParts,
  type YearMonth,
} from './calendarMath';
import { TONE_CLASSES, TONE_LABEL, TONE_ORDER, type CalendarEvent } from './deadlineEvents';
import { useCalendarDeadlines } from './useCalendarDeadlines';
import { useNow } from './useNow';

const UPCOMING_LIMIT = 6;
const UPCOMING_WINDOW_MS = 120 * 86_400_000;
const CHIPS_PER_CELL = 2;

export interface DeadlineCalendarProps {
  /** Различает кэш ролей и филиалов; см. `useCalendarDeadlines`. */
  scopeKey: readonly unknown[];
  timeZoneId: string;
  toEvent: (dto: AssignmentDto) => CalendarEvent;
  /** Подсказка для пустого «Ближайшие», своя у каждой роли. */
  emptyUpcomingHint: string;
}

function pluralDeadlines(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'дедлайн';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дедлайна';
  return 'дедлайнов';
}

/** «Алиджон Забиров» → «АЗ»: в узкой клетке имя ментора не помещается рядом с названием. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function dayHeading(key: string): { weekday: string; date: string } {
  const { year, month, day } = parseDayKey(key);
  return { weekday: WEEKDAY_LONG_RU[weekdayOf(year, month, day)], date: `${day} ${MONTH_NAMES_GENITIVE_RU[month - 1]}` };
}

/**
 * Календарь дедлайнов — общий для Mentor, Lead и Admin. Роль определяет только то, что
 * вернёт сервер, и как подписать событие (`toEvent`); сетка, панели и анимации одни.
 * Пустой месяц — всё тот же аккуратный календарь: сетка, сегодняшний день, спокойные
 * подсказки в боковых панелях вместо заглушки во весь экран.
 */
export function DeadlineCalendar({ scopeKey, timeZoneId, toEvent, emptyUpcomingHint }: DeadlineCalendarProps): JSX.Element {
  const now = useNow(60_000);
  const todayKey = dayKeyOf(now, timeZoneId);

  const [visible, setVisible] = useState<YearMonth>(() => {
    const { year, month } = zonedParts(Date.now(), timeZoneId);
    return { year, month };
  });
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [direction, setDirection] = useState<1 | -1>(1);

  const range = useMemo(() => gridRangeUtc(visible, timeZoneId), [visible, timeZoneId]);
  const month = useCalendarDeadlines(scopeKey, range.fromMs, range.toMs);

  // «Ближайшие» не зависят от листания месяцев: от текущего часа вперёд. Час, а не минута, —
  // чтобы ключ запроса не менялся каждую минуту.
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const upcomingQuery = useCalendarDeadlines(scopeKey, hourStart, hourStart + UPCOMING_WINDOW_MS, { maxItems: 24 });

  const events = useMemo(() => month.items.map(toEvent), [month.items, toEvent]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKeyOf(event.dueAtMs, timeZoneId);
      const list = map.get(key);
      if (list === undefined) map.set(key, [event]);
      else list.push(event);
    }
    return map;
  }, [events, timeZoneId]);

  const upcoming = useMemo(
    () => upcomingQuery.items.map(toEvent).filter((event) => event.tone !== 'done' && event.dueAtMs >= now).slice(0, UPCOMING_LIMIT),
    [upcomingQuery.items, toEvent, now],
  );

  const cells = useMemo(() => monthGrid(visible.year, visible.month), [visible]);

  const monthEvents = events.filter((event) => {
    const { year, month: m } = zonedParts(event.dueAtMs, timeZoneId);
    return year === visible.year && m === visible.month;
  });
  const toneCounts = TONE_ORDER.map((tone) => [tone, monthEvents.filter((event) => event.tone === tone).length] as const).filter(([, count]) => count > 0);

  const goTo = (delta: number): void => {
    setDirection(delta > 0 ? 1 : -1);
    setVisible((current) => shiftMonth(current, delta));
  };

  const goToday = (): void => {
    const { year, month: m } = zonedParts(Date.now(), timeZoneId);
    setDirection(year * 12 + m >= visible.year * 12 + visible.month ? 1 : -1);
    setVisible({ year, month: m });
    setSelectedKey(dayKeyOf(Date.now(), timeZoneId));
  };

  const selectedEvents = byDay.get(selectedKey) ?? [];
  const selectedHeading = dayHeading(selectedKey);
  const isViewingCurrentMonth = (() => {
    const { year, month: m } = zonedParts(now, timeZoneId);
    return year === visible.year && m === visible.month;
  })();

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card padded={false} className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-2 text-[20px] font-semibold tracking-tight text-ink">
              {MONTH_NAMES_RU[visible.month - 1]}
              <span className="font-normal text-ink-muted">{visible.year}</span>
              {month.isPending ? <Loader2 className="h-4 w-4 animate-spin self-center text-ink-muted" aria-label="Загрузка" /> : null}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {monthEvents.length === 0 ? 'В этом месяце дедлайнов нет' : `${monthEvents.length} ${pluralDeadlines(monthEvents.length)} в этом месяце`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              disabled={isViewingCurrentMonth && selectedKey === todayKey}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-medium text-ink transition hover:border-line-strong hover:bg-surface-hover disabled:cursor-default disabled:opacity-50"
            >
              <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              Сегодня
            </button>
            <div className="flex items-center rounded-full border border-line p-0.5">
              <button type="button" onClick={() => { goTo(-1); }} aria-label="Предыдущий месяц" className="grid h-8 w-8 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover hover:text-ink">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => { goTo(1); }} aria-label="Следующий месяц" className="grid h-8 w-8 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-hover hover:text-ink">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {month.error ? (
          <div className="border-b border-divider p-5">
            <ErrorState error={month.error} title="Не удалось загрузить дедлайны" />
          </div>
        ) : null}

        <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          <div className="grid grid-cols-7">
            {WEEKDAY_SHORT_RU.map((label, index) => (
              <div key={label} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] ${index >= 5 ? 'text-ink-disabled' : 'text-ink-muted'}`}>
                {label}
              </div>
            ))}
          </div>

          <div
            key={`${visible.year}-${visible.month}`}
            className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${direction > 0 ? 'motion-safe:animate-calendar-next' : 'motion-safe:animate-calendar-prev'}`}
          >
            {cells.map((cell) => {
              const dayEvents = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              const isWeekend = cell.weekday >= 5;
              const extra = dayEvents.length - CHIPS_PER_CELL;
              const label = `${cell.day} ${MONTH_NAMES_GENITIVE_RU[cell.month - 1]}${dayEvents.length > 0 ? `, ${dayEvents.length} ${pluralDeadlines(dayEvents.length)}` : ''}${isToday ? ', сегодня' : ''}`;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => { setSelectedKey(cell.key); }}
                  aria-label={label}
                  aria-pressed={isSelected}
                  className={[
                    'group relative flex min-h-[56px] flex-col items-stretch gap-1 rounded-control border p-1.5 text-left transition duration-150 sm:min-h-[104px] sm:p-2',
                    isSelected
                      ? 'border-brand bg-brand-soft shadow-surface'
                      : isToday
                        ? 'border-brand-soft-hover bg-surface'
                        : 'border-transparent hover:border-line hover:bg-surface-muted',
                    cell.inMonth ? '' : 'opacity-40',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-7 w-7 place-items-center rounded-full text-[13px] tabular-nums transition',
                      isToday ? 'bg-brand font-semibold text-white shadow-[0_4px_12px_-4px_var(--primary)]' : isSelected ? 'font-semibold text-brand-active' : isWeekend ? 'text-ink-disabled group-hover:text-ink' : 'text-ink-secondary group-hover:text-ink',
                    ].join(' ')}
                  >
                    {cell.day}
                  </span>

                  {/* Телефон: точки по состояниям. Шире — плашки с названиями. */}
                  {dayEvents.length > 0 ? (
                    <>
                      <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden" aria-hidden="true">
                        {dayEvents.slice(0, 4).map((event) => (
                          <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${TONE_CLASSES[event.tone].dot}`} />
                        ))}
                      </span>
                      <span className="hidden min-w-0 flex-col gap-1 sm:flex" aria-hidden="true">
                        {dayEvents.slice(0, CHIPS_PER_CELL).map((event) => (
                          <span
                            key={event.id}
                            className={`flex min-w-0 items-stretch gap-1.5 rounded-md py-[3px] pl-1 pr-1.5 text-[11px] font-medium leading-4 transition ${TONE_CLASSES[event.tone].chip} ${TONE_CLASSES[event.tone].text}`}
                          >
                            <span className={`w-[3px] shrink-0 rounded-full ${TONE_CLASSES[event.tone].dot}`} />
                            {event.person !== null ? <span className="shrink-0 font-semibold opacity-70">{initialsOf(event.person)}</span> : null}
                            <span className="truncate">{event.title}</span>
                          </span>
                        ))}
                        {extra > 0 ? <span className="px-1.5 text-[11px] font-medium text-ink-muted">ещё {extra}</span> : null}
                      </span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-divider px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {TONE_ORDER.map((tone) => (
              <span key={tone} className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span className={`h-2 w-2 rounded-full ${TONE_CLASSES[tone].dot}`} aria-hidden="true" />
                {TONE_LABEL[tone]}
                {toneCounts.find(([t]) => t === tone) ? <span className="tabular-nums text-ink-secondary">{toneCounts.find(([t]) => t === tone)?.[1]}</span> : null}
              </span>
            ))}
          </div>
          <span className="text-[11.5px] text-ink-disabled">Время: {timeZoneId}</span>
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 pb-3 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
              {selectedKey === todayKey ? 'Сегодня' : 'Выбранный день'} · {selectedHeading.weekday}
            </p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight text-ink">{selectedHeading.date}</p>
          </div>
          <div key={selectedKey} className="flex flex-col gap-2 px-4 pb-4 motion-safe:animate-fade-in">
            {selectedEvents.length === 0 ? (
              <div className="flex items-center gap-3 rounded-control bg-surface-muted px-3.5 py-3.5 text-[13px] text-ink-muted">
                <CalendarCheck2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                Дедлайнов на этот день нет
              </div>
            ) : (
              selectedEvents.map((event) => <DayEventRow key={event.id} event={event} timeZoneId={timeZoneId} />)
            )}
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h3 className="text-[15px] font-semibold text-ink">Ближайшие</h3>
            {upcomingQuery.isPending ? <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-label="Загрузка" /> : null}
          </div>
          <ul className="flex flex-col px-2 pb-3">
            {upcoming.length === 0 && !upcomingQuery.isPending ? (
              <li className="flex items-start gap-3 px-3 py-3 text-[13px] text-ink-muted">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-ink-disabled" aria-hidden="true" />
                {emptyUpcomingHint}
              </li>
            ) : (
              upcoming.map((event) => <UpcomingRow key={event.id} event={event} timeZoneId={timeZoneId} />)
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function DayEventRow({ event, timeZoneId }: { event: CalendarEvent; timeZoneId: string }): JSX.Element {
  const tone = TONE_CLASSES[event.tone];
  return (
    <Link
      to={event.href}
      className="group flex min-w-0 gap-3 rounded-control border border-line bg-surface p-3 transition hover:-translate-y-px hover:border-line-strong hover:shadow-surface-hover"
    >
      <span className={`w-1 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span className="w-12 shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">{formatTime(event.dueAtMs, timeZoneId)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-brand">{event.title}</span>
        {event.person !== null || event.context !== null ? (
          <span className="mt-0.5 block truncate text-[12px] text-ink-muted">{[event.person, event.context].filter(Boolean).join(' · ')}</span>
        ) : null}
        <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.chip} ${tone.text}`}>{TONE_LABEL[event.tone]}</span>
      </span>
    </Link>
  );
}

function UpcomingRow({ event, timeZoneId }: { event: CalendarEvent; timeZoneId: string }): JSX.Element {
  const { month, day } = zonedParts(event.dueAtMs, timeZoneId);
  return (
    <li>
      <Link to={event.href} className="group flex min-w-0 items-center gap-3 rounded-control px-3 py-2.5 transition hover:bg-surface-hover">
        <span className="grid w-11 shrink-0 place-items-center rounded-control border border-line bg-surface-muted py-1 leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand">{MONTH_NAMES_GENITIVE_RU[month - 1].slice(0, 3)}</span>
          <span className="text-[16px] font-semibold tabular-nums text-ink">{day}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-brand">{event.title}</span>
          <span className="block truncate text-[12px] text-ink-muted">
            {formatTime(event.dueAtMs, timeZoneId)}
            {event.person !== null ? ` · ${event.person}` : ''}
          </span>
        </span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_CLASSES[event.tone].dot}`} aria-label={TONE_LABEL[event.tone]} />
      </Link>
    </li>
  );
}
