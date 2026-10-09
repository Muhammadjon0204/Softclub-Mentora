import { ArrowUpRight, CalendarDays, PartyPopper } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import type { AssignmentDto } from '../../api/lead/assignments';
import { MONTH_NAMES_GENITIVE_RU, WEEKDAY_SHORT_RU, countdownParts, dayKeyOf, formatTime, weekdayOf, zonedParts } from '../deadline-calendar/calendarMath';
import { useCalendarDeadlines } from '../deadline-calendar/useCalendarDeadlines';
import { useNow } from '../deadline-calendar/useNow';
import { useMentorScope } from '../mentor/scope/useMentorScope';

const DAY_MS = 86_400_000;

/** Где ментору ещё нужно действовать: назначено, вернули на доработку, уже просрочено. */
const ACTIONABLE = new Set(['Assigned', 'NeedsRework', 'Overdue']);

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function dueLabel(ms: number, nowMs: number, timeZoneId: string): string {
  const key = dayKeyOf(ms, timeZoneId);
  const time = formatTime(ms, timeZoneId);
  if (key === dayKeyOf(nowMs, timeZoneId)) return `Сегодня в ${time}`;
  if (key === dayKeyOf(nowMs + DAY_MS, timeZoneId)) return `Завтра в ${time}`;
  if (key === dayKeyOf(nowMs - DAY_MS, timeZoneId)) return `Вчера в ${time}`;
  const { year, month, day } = zonedParts(ms, timeZoneId);
  return `${WEEKDAY_SHORT_RU[weekdayOf(year, month, day)]}, ${day} ${MONTH_NAMES_GENITIVE_RU[month - 1]} · ${time}`;
}

function shortIn(diffMs: number): string {
  const { days, hours, minutes } = countdownParts(diffMs);
  if (days > 0) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  if (hours > 0) return `через ${hours} ч ${minutes} мин`;
  return `через ${minutes} мин`;
}

type Urgency = 'calm' | 'soon' | 'urgent' | 'overdue';

function urgencyOf(diffMs: number): Urgency {
  if (diffMs < 0) return 'overdue';
  if (diffMs < 3 * 3_600_000) return 'urgent';
  if (diffMs < DAY_MS) return 'soon';
  return 'calm';
}

const BACKGROUND: Record<Urgency, string> = {
  calm: 'linear-gradient(135deg, #1d1d57 0%, #2f2f8f 55%, #4b4cd0 100%)',
  soon: 'linear-gradient(135deg, #1d1d57 0%, #34307f 55%, #6b4fc4 100%)',
  urgent: 'linear-gradient(135deg, #2a1846 0%, #5b2a6e 55%, #b4486b 100%)',
  overdue: 'linear-gradient(135deg, #2d1220 0%, #6b1f33 55%, #c13f4f 100%)',
};

const BAR: Record<Urgency, string> = {
  calm: 'bg-white',
  soon: 'bg-[#ffd18a]',
  urgent: 'bg-[#ffb3a7]',
  overdue: 'bg-[#ff9d9d]',
};

/** Волнистые линии фона — тот же приём, что у карточки Time Tracker из референса, в цветах Mentora. */
function ContourLines(): JSX.Element {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <path
          key={index}
          d={`M ${-120 + index * 46} 280 C ${120 + index * 40} ${150 - index * 6}, ${360 + index * 30} ${210 - index * 14}, ${880} ${-20 + index * 12}`}
          fill="none"
          stroke="white"
          strokeOpacity={0.05 + (index % 4) * 0.015}
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

/** Две цифры, каждая со своей анимацией: меняется только та, что изменилась. */
function Digits({ value }: { value: number }): JSX.Element {
  const text = String(value).padStart(2, '0');
  return (
    <span className="inline-flex overflow-hidden">
      {text.split('').map((digit, index) => (
        <span key={`${index}-${digit}`} className="inline-block w-[0.62em] text-center motion-safe:animate-digit-in">
          {digit}
        </span>
      ))}
    </span>
  );
}

function Unit({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[40px] font-semibold leading-none tracking-tight tabular-nums sm:text-[54px]">
        <Digits value={value} />
      </span>
      <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/60">{label}</span>
    </div>
  );
}

function Colon(): JSX.Element {
  return <span className="pb-6 text-[34px] font-light leading-none text-white/40 motion-safe:animate-colon-blink sm:text-[46px]" aria-hidden="true">:</span>;
}

/**
 * Обратный отсчёт до ближайшего дедлайна ментора — «до сдачи N дн ЧЧ:ММ:СС».
 * Берёт ближайшее будущее задание, по которому ещё нужно действовать; если таких нет, но есть
 * просроченное — считает, сколько оно уже просрочено. Секунды тикают только пока вкладка
 * видна (`useNow`).
 */
export function DeadlineCountdownCard(): JSX.Element {
  const scope = useMentorScope();
  const now = useNow(1_000);

  // Окно с запасом назад — чтобы увидеть уже просроченные задания.
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const { items, isPending } = useCalendarDeadlines(
    ['mentor', scope.organizationId, scope.mentorId],
    hourStart - 90 * DAY_MS,
    hourStart + 400 * DAY_MS,
  );

  const { target, queue, overdueCount } = useMemo(() => {
    const actionable = items.filter((dto: AssignmentDto) => ACTIONABLE.has(dto.status));
    const future = actionable
      .filter((dto) => dto.status !== 'Overdue' && Date.parse(dto.currentDueAt) > now)
      .sort((a, b) => Date.parse(a.currentDueAt) - Date.parse(b.currentDueAt));
    const overdue = actionable
      .filter((dto) => dto.status === 'Overdue' || Date.parse(dto.currentDueAt) <= now)
      .sort((a, b) => Date.parse(a.currentDueAt) - Date.parse(b.currentDueAt));
    return {
      target: future[0] ?? overdue[0] ?? null,
      queue: future.slice(1, 4),
      overdueCount: overdue.length,
    };
  }, [items, now]);

  if (target === null) {
    return (
      <div className="relative overflow-hidden rounded-panel p-6 text-white shadow-card sm:p-7" style={{ background: BACKGROUND.calm }}>
        <ContourLines />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10">
              <PartyPopper className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Трекер дедлайнов</p>
              <p className="mt-1 text-[20px] font-semibold tracking-tight">{isPending ? 'Смотрим ваши задания…' : 'Активных дедлайнов нет'}</p>
              {!isPending ? <p className="mt-0.5 text-[13px] text-white/70">Когда руководитель назначит задание, здесь начнётся обратный отсчёт.</p> : null}
            </div>
          </div>
          <Link to="/mentor/calendar" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[13px] font-medium text-white transition hover:bg-white/10">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Открыть календарь
          </Link>
        </div>
      </div>
    );
  }

  const dueMs = Date.parse(target.currentDueAt);
  const diff = dueMs - now;
  const urgency = urgencyOf(diff);
  const parts = countdownParts(diff);
  const startMs = target.assignedAt !== null ? Date.parse(target.assignedAt) : Date.parse(target.createdAt);
  const total = Math.max(dueMs - startMs, 1);
  const remainingShare = urgency === 'overdue' ? 0 : Math.min(Math.max(diff / total, 0), 1);

  const heading = urgency === 'overdue' ? 'Просрочено на' : 'До ближайшего дедлайна';
  const badge =
    urgency === 'overdue' ? 'Просрочено' : urgency === 'urgent' ? 'Меньше 3 часов' : urgency === 'soon' ? 'Меньше суток' : target.status === 'NeedsRework' ? 'На доработке' : 'В работе';

  return (
    <div className="relative overflow-hidden rounded-panel text-white shadow-card" style={{ background: BACKGROUND[urgency] }}>
      <ContourLines />
      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{heading}</p>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-inset ring-white/20">{badge}</span>
          </div>

          <p className="mt-3 truncate text-[18px] font-semibold tracking-tight sm:text-[20px]" title={target.title}>{target.title}</p>
          <p className="mt-0.5 text-[13px] text-white/65">
            {dueLabel(dueMs, now, scope.timeZoneId)}
            {overdueCount > 1 || (overdueCount === 1 && urgency !== 'overdue') ? ` · просрочено заданий: ${overdueCount}` : ''}
          </p>

          <div className="mt-5 flex items-end gap-2 sm:gap-3" role="timer" aria-live="off" aria-label={`${heading}: ${parts.days} дн ${parts.hours} ч ${parts.minutes} мин`}>
            <Unit value={parts.days} label={plural(parts.days, 'день', 'дня', 'дней')} />
            <Colon />
            <Unit value={parts.hours} label={plural(parts.hours, 'час', 'часа', 'часов')} />
            <Colon />
            <Unit value={parts.minutes} label="мин" />
            <Colon />
            <Unit value={parts.seconds} label="сек" />
          </div>

          <div className="mt-6 max-w-[520px]">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${BAR[urgency]}`} style={{ width: `${(urgency === 'overdue' ? 1 : remainingShare) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-white/60">
              {urgency === 'overdue' ? 'Срок вышел — отправьте решение как можно скорее' : `Осталось ${Math.round(remainingShare * 100)}% времени на задание`}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              to={`/mentor/tasks?assignmentId=${target.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-[#23236b] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] transition hover:-translate-y-px hover:bg-white/90"
            >
              Открыть задание
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/mentor/calendar" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[13px] font-medium text-white transition hover:bg-white/10">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Календарь
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/10 p-5 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Дальше по очереди</p>
          {queue.length === 0 ? (
            <p className="mt-3 text-[13px] text-white/65">Других дедлайнов пока нет.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {queue.map((dto) => {
                const ms = Date.parse(dto.currentDueAt);
                const { day, month } = zonedParts(ms, scope.timeZoneId);
                return (
                  <li key={dto.id}>
                    <Link to={`/mentor/tasks?assignmentId=${dto.id}`} className="flex min-w-0 items-center gap-3 rounded-control px-2 py-2 transition hover:bg-white/10">
                      <span className="grid w-10 shrink-0 place-items-center rounded-control bg-white/10 py-1 leading-tight">
                        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-white/60">{MONTH_NAMES_GENITIVE_RU[month - 1].slice(0, 3)}</span>
                        <span className="text-[15px] font-semibold tabular-nums">{day}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{dto.title}</span>
                        <span className="block text-[11.5px] text-white/60">{shortIn(ms - now)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
