import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CRM_QUERY_KEYS, getCrmGroup, type CrmOverall, type CrmPeriod, type CrmStudentScore } from '../../api/admin/crm';
import { Drawer } from '../../shared/overlays';
import { Select } from '../../shared/select';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmReportPanel } from './CrmReportPanel';
import { ABSENCE_LABEL, REMARK_LABEL, STUDENT_STATUS, ZONE, formatDay, formatRange, percent, periodTitle, zoneText } from './crmPresentation';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

const DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  brand: 'bg-brand',
  neutral: 'bg-ink-muted',
};

const DOT_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  brand: 'text-brand',
  neutral: 'text-ink-muted',
};

/** Статус — точка и подпись, без плашки: строка таблицы остаётся спокойной, цвет несёт только точка и текст. */
function Status({ tone, children }: { tone: Tone; children: React.ReactNode }): JSX.Element {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium ${DOT_TEXT[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{children}</h3>
      {aside ? <span className="text-[12px] text-ink-muted">{aside}</span> : null}
    </div>
  );
}

interface Metric {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

/** Сводка одной полосой с тонкими разделителями вместо отдельных карточек. */
function Metrics({ items }: { items: Metric[] }): JSX.Element {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-control border border-line sm:grid-cols-4">
      {items.map((m, index) => (
        <div
          key={m.label}
          className={`px-4 py-3 ${index % 2 === 1 ? 'border-l border-divider' : ''} ${index >= 2 ? 'border-t border-divider sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}
        >
          <dt className="text-[11.5px] text-ink-muted">{m.label}</dt>
          <dd className="mt-1 text-[18px] font-semibold leading-6 tabular-nums text-ink">{m.value}</dd>
          {m.hint ? <dd className="mt-0.5 text-[11.5px] text-ink-muted">{m.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** 80+ · 70–79 · ниже 70: цифры в цвете зоны, разделители нейтральные. */
function zones(passed: number, support: number, risk: number): Metric {
  return {
    label: '80+ · 70–79 · ниже 70',
    value: (
      <>
        <span className="text-success">{passed}</span>
        <span className="px-1 text-ink-muted">·</span>
        <span className="text-warning">{support}</span>
        <span className="px-1 text-ink-muted">·</span>
        <span className="text-danger">{risk}</span>
      </>
    ),
  };
}

function scoreParts(student: CrmStudentScore, examMax: number): string {
  const bonus = student.bonusPoints > 0 ? ` · бонус ${String(student.bonusPoints)}` : '';
  return `посещение ${String(student.attendancePoints)} · задания ${String(student.homeworkPoints)}${bonus} · экзамен ${student.examGrade === null || student.examGrade === undefined ? '—' : String(student.examGrade)}/${String(examMax)}`;
}

/** Строка студента: [балл | имя и детали | статус и счётчики]. */
const ROW = 'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-4 py-2.5';

function Counters({ student, className = '' }: { student: CrmStudentScore; className?: string }): JSX.Element | null {
  const parts = [
    student.absentDays.length > 0 ? `пропуск ${String(student.absentDays.length)}` : null,
    student.lateDays.length > 0 ? `опозд. ${String(student.lateDays.length)}` : null,
    student.remarks.length > 0 ? `замечаний ${String(student.remarks.length)}` : null,
  ].filter(Boolean);

  if (parts.length === 0 && student.issues.length === 0) {
    return null;
  }

  return (
    <span className={`items-center gap-2 whitespace-nowrap text-[12px] tabular-nums text-ink-muted ${className}`}>
      {parts.length > 0 ? <span>{parts.join(' · ')}</span> : null}
      {student.issues.length > 0 ? (
        <span className="inline-flex items-center gap-1 text-danger" title="Проблемы в данных">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />{student.issues.length}
        </span>
      ) : null}
    </span>
  );
}

function StudentRow({ student, examMax }: { student: CrmStudentScore; examMax: number }): JSX.Element {
  const [open, setOpen] = useState(false);
  const details = student.lateDays.length + student.absentDays.length + student.unfilledDays.length + student.zeroHomeworkDays.length + student.issues.length + student.remarks.length;

  if (student.fill === 'Empty') {
    return (
      <li className={ROW}>
        <span className="text-right text-[15px] font-semibold text-ink-muted">—</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-ink-secondary">{student.fullName}</span>
          <span className="block text-[12.5px] text-ink-muted">дни этой недели ещё не отмечены</span>
        </span>
        <span />
      </li>
    );
  }

  const partial = student.fill === 'Partial';
  const zone = ZONE[student.zone];
  return (
    <li>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        disabled={details === 0}
        className={`${ROW} w-full text-left disabled:cursor-default enabled:hover:bg-surface-hover/60`}
        aria-expanded={open}
      >
        <span className={`text-right text-[15px] font-semibold tabular-nums ${partial ? 'text-ink-muted' : zoneText(student.zone)}`}>{student.total}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-ink">{student.fullName}</span>
          <span className="block text-[12.5px] text-ink-muted sm:truncate">
            {partial
              ? `неделя идёт: отмечено ${String(student.filledDays)} из ${String(student.expectedDays)} дн.`
              : scoreParts(student, examMax)}
          </span>
          {/* На узком экране счётчики уходят под имя — иначе съедают его. */}
          <Counters student={student} className="mt-0.5 flex sm:hidden" />
        </span>
        <span className="flex items-center justify-end gap-3">
          <Counters student={student} className="hidden sm:flex" />
          {!partial && zone ? <Status tone={zone.tone}>{zone.label}</Status> : null}
          {details > 0 ? (
            <ChevronDown className={`h-3.5 w-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          ) : <span className="w-3.5" />}
        </span>
      </button>
      {open ? (
        <div className="mb-3 ml-14 space-y-1 border-l border-divider pl-3 text-[12.5px] leading-5 text-ink-secondary">
          {partial ? <p>Пока посчитано: {scoreParts(student, examMax)}</p> : null}
          {student.lateDays.map((l) => (
            <p key={`l${l.date}`}><span className="font-medium text-warning">Опоздал {formatDay(l.date)}</span>{l.minutes > 0 ? ` на ${String(l.minutes)} мин` : ''}{l.note ? ` — ${l.note}` : ''}</p>
          ))}
          {student.absentDays.map((a) => (
            <p key={`a${a.date}`}><span className="font-medium text-ink">{formatDay(a.date)}:</span> {ABSENCE_LABEL[a.kind] ?? a.kind}{a.note ? ` — ${a.note}` : ''}</p>
          ))}
          {student.remarks.map((r, index) => (
            <p key={`r${r.date}${String(index)}`}><span className="font-medium text-ink">{formatDay(r.date)}:</span> <span className="text-info">{REMARK_LABEL[r.kind] ?? r.kind}</span> — {r.text}{r.author ? <span className="text-ink-muted"> ({r.author})</span> : null}</p>
          ))}
          {student.unfilledDays.length > 0 ? (
            <p><span className="font-medium text-ink">Ещё не отмечено:</span> {student.unfilledDays.map((d) => formatDay(d)).join(', ')}</p>
          ) : null}
          {student.zeroHomeworkDays.length > 0 ? (
            <p><span className="font-medium text-ink">Ноль за задание:</span> {student.zeroHomeworkDays.map((d) => formatDay(d)).join(', ')}</p>
          ) : null}
          {student.issues.map((i) => (
            <p key={i.code + i.message} className="flex gap-1.5 text-danger"><AlertTriangle className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />{i.message}</p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Неделя журнала: даты, кто вёл, сводка и студенты. С `groupId` — ещё и блок отчёта за неделю; без
 * него (просмотр отправленного отчёта) — только цифры.
 */
export function CrmPeriodView({ period, groupId }: { period: CrmPeriod; groupId?: number }): JSX.Element {
  const s = period.summary;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-secondary">
        <span className="tabular-nums">{formatRange(period.from, period.to)}</span>
        <Status tone={period.isComplete ? 'success' : 'info'}>{period.isComplete ? 'неделя закрыта' : 'идёт сейчас'}</Status>
        {!period.hasExam ? <span className="text-[12px] text-ink-muted">без экзамена</span> : null}
      </div>
      {period.mentors.length > 0 ? (
        <p className="text-[13px] text-ink-secondary"><span className="text-ink-muted">Вели группу:</span> {period.mentors.join(', ')}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] text-warning"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />В CRM у группы нет ментора за этот период — отчёт некому сдать</p>
      )}
      {groupId !== undefined ? <CrmReportPanel groupId={groupId} week={period.week} /> : null}
      <Metrics
        items={[
          { label: 'Средний итог', value: s.averageTotal === null || s.averageTotal === undefined ? '—' : String(s.averageTotal), hint: `по ${String(s.students)} студ.` },
          zones(s.passed, s.support, s.risk),
          { label: 'Посещаемость', value: percent(s.attendanceRate), hint: 'по прошедшим дням' },
          { label: 'Отмечено дней', value: percent(s.fillRate) },
        ]}
      />
      {s.partialStudents + s.emptyStudents > 0 ? (
        <p className="text-[12.5px] text-ink-muted">
          Неделя ещё идёт — средний и зоны появятся, когда пройдут все дни.
          {s.partialStudents > 0 ? ` Отмечено не до конца: ${String(s.partialStudents)} студ.` : ''}
        </p>
      ) : null}
      {period.students.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="Нет студентов" description="В эту неделю в группе никого не было." />
      ) : (
        <ul className="divide-y divide-divider border-y border-divider">
          {period.students.map((student) => <StudentRow key={student.studentId} student={student} examMax={period.examMax} />)}
        </ul>
      )}
    </div>
  );
}

/** Итог по закрытым неделям: у студента — средний из полностью заполненных недель, у группы — средний по студентам. */
function OverallView({ overall }: { overall: CrmOverall }): JSX.Element {
  if (overall.studentResults.length === 0) {
    return <p className="text-[13px] text-ink-muted">Закрытых недель пока нет.</p>;
  }
  return (
    <div className="space-y-4">
      <Metrics
        items={[
          { label: 'Средний балл', value: overall.averageTotal === null || overall.averageTotal === undefined ? '—' : String(overall.averageTotal), hint: 'средний из недельных итогов' },
          zones(overall.passed, overall.support, overall.risk),
          { label: 'Посещаемость', value: percent(overall.attendanceRate), hint: 'по прошедшим дням' },
          { label: 'Закрытых недель', value: String(overall.periods) },
        ]}
      />
      <ul className="divide-y divide-divider border-y border-divider">
        {overall.studentResults.map((s) => {
          const zone = s.zone ? ZONE[s.zone] : undefined;
          const notFull = s.partialWeeks + s.emptyWeeks;
          return (
            <li key={s.studentId} className={ROW}>
              <span className={`text-right text-[15px] font-semibold tabular-nums ${zoneText(s.zone)}`}>{s.averageTotal ?? '—'}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">{s.fullName}</span>
                <span className="block text-[12.5px] text-ink-muted sm:truncate">
                  недель в группе {s.weeks}
                  {notFull > 0 ? ` · не отмечено ${String(notFull)}` : ''}
                  {s.fullWeeks > 1 ? ` · от ${String(s.minTotal)} до ${String(s.maxTotal)}` : ''}
                  {s.absent > 0 ? ` · пропусков ${String(s.absent)}` : ''}
                  {s.late > 0 ? ` · опозданий ${String(s.late)}` : ''}
                </span>
              </span>
              {zone ? <Status tone={zone.tone}>{zone.label}</Status> : <Status tone="neutral">нет полных недель</Status>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Выбор недели журнала: стрелки «раньше / позже» и список с датами. Вместо полосы из тридцати вкладок
 * с горизонтальной прокруткой — одна строка, которая не растёт с курсом.
 */
function WeekPicker({ periods, value, onChange }: { periods: CrmPeriod[]; value: number; onChange: (week: number) => void }): JSX.Element {
  // Периоды приходят от новых к старым.
  const index = periods.findIndex((p) => p.week === value);
  const older = index >= 0 ? periods[index + 1] : undefined;
  const newer = index > 0 ? periods[index - 1] : undefined;
  const arrow = 'grid h-8 w-8 shrink-0 place-items-center rounded-control border border-line text-ink-secondary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" className={arrow} onClick={() => { if (older) onChange(older.week); }} disabled={!older} aria-label="Предыдущая неделя">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="w-full max-w-[280px]">
        <Select
          size="sm"
          value={String(value)}
          onValueChange={(v) => { onChange(Number(v)); }}
          ariaLabel="Неделя журнала"
          options={periods.map((p) => ({
            value: String(p.week),
            label: `${periodTitle(p.label)}${p.summary.issueCount > 0 ? ' · есть проблемы' : ''}`,
            description: p.isComplete ? formatRange(p.from, p.to) : `${formatRange(p.from, p.to)} · идёт`,
          }))}
        />
      </div>
      <button type="button" className={arrow} onClick={() => { if (newer) onChange(newer.week); }} disabled={!newer} aria-label="Следующая неделя">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="ml-auto hidden text-[12px] text-ink-muted sm:inline">недель в журнале: {periods.length}</span>
    </div>
  );
}

const ROLE_TONE: Record<string, Tone> = { 'Ведёт': 'brand', 'Помогает': 'info', 'Снят': 'neutral' };

/** Группа из CRM: состав, менторы по датам и журнал, посчитанный по неделям так же, как считает CRM. */
export function CrmGroupDrawer({ groupId, onClose }: { groupId: number | null; onClose: () => void }): JSX.Element {
  const query = useQuery({
    queryKey: CRM_QUERY_KEYS.group(groupId ?? 0),
    queryFn: () => getCrmGroup(groupId ?? 0),
    enabled: groupId !== null,
  });
  const [week, setWeek] = useState<number | null>(null);

  useEffect(() => { setWeek(null); }, [groupId]);

  const data = query.data;
  // По умолчанию — последний закрытый период: текущий ещё не заполнен до конца.
  const defaultWeek = data?.periods.find((p) => p.isComplete)?.week ?? data?.periods[0]?.week ?? null;
  const period = data?.periods.find((p) => p.week === (week ?? defaultWeek)) ?? null;

  return (
    <Drawer
      open={groupId !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={data?.group.name ?? 'Группа CRM'}
      description={data ? `${data.group.course.name} · ${data.group.branch.name} · ${formatRange(data.group.startsOn, data.group.finishesOn)}` : undefined}
      size="xl"
    >
      {query.isPending ? (
        <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />
      ) : data ? (
        <div className="space-y-9">
          <section>
            <SectionTitle>Менторы по датам</SectionTitle>
            {data.mentors.length === 0 ? (
              <p className="text-[13px] text-warning">В CRM у группы нет ни одного ментора.</p>
            ) : (
              <ul className="divide-y divide-divider border-y border-divider">
                {data.mentors.map((m) => (
                  <li key={`${String(m.id)}-${m.from}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                    <span className="truncate text-[14px] font-medium text-ink">{m.fullName}</span>
                    <Status tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role}</Status>
                    <span className="col-span-2 text-[12.5px] tabular-nums text-ink-muted sm:col-span-1 sm:text-right">
                      {formatDay(m.from, true)} — {m.to ? formatDay(m.to, true) : '…'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.journalUnavailable ? null : (
            <section>
              <SectionTitle>Итог по закрытым неделям</SectionTitle>
              <OverallView overall={data.overall} />
            </section>
          )}

          <section>
            <SectionTitle>Журнал по неделям</SectionTitle>
            {data.journalUnavailable ? (
              <p className="rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning">{data.journalUnavailable}</p>
            ) : (
              <>
                {period ? <WeekPicker periods={data.periods} value={period.week} onChange={setWeek} /> : null}
                {period ? <CrmPeriodView period={period} groupId={data.group.id} /> : <p className="text-[13px] text-ink-muted">Периодов пока нет.</p>}
              </>
            )}
          </section>

          <section>
            <SectionTitle aside={`${String(data.students.length)} студ.`}>Состав группы</SectionTitle>
            <ul className="divide-y divide-divider border-y border-divider">
              {data.students.map((s) => {
                const status = STUDENT_STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const };
                return (
                  <li key={s.id} className="py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                      <span className="truncate text-[14px] font-medium text-ink">{s.fullName}</span>
                      <Status tone={status.tone}>{status.label}</Status>
                      <span className="col-span-2 text-[12.5px] tabular-nums text-ink-muted sm:col-span-1 sm:text-right">
                        с {formatDay(s.joinedOn, true)}{s.leftOn ? ` по ${formatDay(s.leftOn, true)}` : ''}
                      </span>
                    </div>
                    {s.note ? <p className="mt-1 max-w-[72ch] text-[12.5px] leading-5 text-ink-muted">{s.note}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
