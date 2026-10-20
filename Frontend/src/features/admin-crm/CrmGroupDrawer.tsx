import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarRange, Clock3, GraduationCap, Sigma, UserMinus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CRM_QUERY_KEYS, getCrmGroup, type CrmOverall, type CrmPeriod, type CrmStudentScore } from '../../api/admin/crm';
import { Drawer } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { ABSENCE_LABEL, STUDENT_STATUS, ZONE, formatDay, formatRange, percent, periodTitle, zoneText } from './crmPresentation';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2.5">
      <p className="text-[11.5px] text-ink-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="text-[11.5px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** 80+ / 70–79 / ниже 70 — три цифры в одной плашке. */
function Zones({ passed, support, risk }: { passed: number; support: number; risk: number }): JSX.Element {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2.5">
      <p className="text-[11.5px] text-ink-muted">80+ · 70–79 · ниже 70</p>
      <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
        <span className="text-success">{passed}</span><span className="text-ink-muted"> · </span>
        <span className="text-warning">{support}</span><span className="text-ink-muted"> · </span>
        <span className="text-danger">{risk}</span>
      </p>
    </div>
  );
}

function scoreParts(student: CrmStudentScore, examMax: number): string {
  const bonus = student.bonusPoints > 0 ? ` · бонус ${String(student.bonusPoints)}` : '';
  return `посещение ${String(student.attendancePoints)} · задания ${String(student.homeworkPoints)}${bonus} · экзамен ${student.examGrade === null || student.examGrade === undefined ? '—' : String(student.examGrade)}/${String(examMax)}`;
}

function StudentRow({ student, examMax }: { student: CrmStudentScore; examMax: number }): JSX.Element {
  const [open, setOpen] = useState(false);
  const details = student.lateDays.length + student.absentDays.length + student.unfilledDays.length + student.zeroHomeworkDays.length + student.issues.length;

  if (student.fill === 'Empty') {
    return (
      <li className="flex items-center gap-3 py-3">
        <span className="w-12 shrink-0 text-right text-[20px] font-semibold text-ink-muted">—</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink-secondary">{student.fullName}</span>
          <span className="block text-[12px] text-ink-muted">ментор не заполнил ни одного дня — в средний балл не идёт</span>
        </span>
      </li>
    );
  }

  const partial = student.fill === 'Partial';
  const zone = ZONE[student.zone];
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); }}
        disabled={details === 0}
        className="flex w-full items-center gap-3 text-left disabled:cursor-default"
        aria-expanded={open}
      >
        <span className={`w-12 shrink-0 text-right text-[20px] font-semibold tabular-nums ${partial ? 'text-ink-muted' : zoneText(student.zone)}`}>{student.total}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{student.fullName}</span>
          <span className="block text-[12px] text-ink-muted">
            {partial
              ? `заполнено ${String(student.filledDays)} из ${String(student.expectedDays)} дн. — в средний не идёт`
              : scoreParts(student, examMax)}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {!partial && zone ? <Badge tone={zone.tone}>{zone.label}</Badge> : null}
          {student.lateDays.length > 0 ? <Badge tone="warning">опозд. {student.lateDays.length}</Badge> : null}
          {student.absentDays.length > 0 ? <Badge tone="danger">пропуск {student.absentDays.length}</Badge> : null}
          {student.issues.length > 0 ? <Badge tone="danger">⚠ {student.issues.length}</Badge> : null}
        </span>
      </button>
      {open ? (
        <div className="ml-[60px] mt-2 space-y-1.5 text-[12.5px] text-ink-secondary">
          {partial ? <p>Пока посчитано: {scoreParts(student, examMax)}</p> : null}
          {student.lateDays.map((l) => (
            <p key={`l${l.date}`}><span className="font-medium text-warning">Опоздал {formatDay(l.date)}</span>{l.minutes > 0 ? ` на ${String(l.minutes)} мин` : ''}{l.note ? ` — ${l.note}` : ''}</p>
          ))}
          {student.absentDays.map((a) => (
            <p key={`a${a.date}`}><span className="font-medium text-ink">{formatDay(a.date)}: {ABSENCE_LABEL[a.kind] ?? a.kind}</span>{a.note ? ` — ${a.note}` : ''}</p>
          ))}
          {student.unfilledDays.length > 0 ? (
            <p><span className="font-medium text-ink">Ментор не заполнил:</span> {student.unfilledDays.map((d) => formatDay(d)).join(', ')}</p>
          ) : null}
          {student.zeroHomeworkDays.length > 0 ? (
            <p><span className="font-medium text-ink">Ноль за задание:</span> {student.zeroHomeworkDays.map((d) => formatDay(d)).join(', ')}</p>
          ) : null}
          {student.issues.map((i) => (
            <p key={i.code + i.message} className="flex gap-1.5 text-danger"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{i.message}</p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PeriodView({ period }: { period: CrmPeriod }): JSX.Element {
  const s = period.summary;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary">
        <CalendarRange className="h-4 w-4 text-ink-muted" aria-hidden="true" />
        {formatRange(period.from, period.to)}
        <Badge tone={period.isComplete ? 'success' : 'info'}>{period.isComplete ? 'неделя закрыта' : 'идёт сейчас'}</Badge>
        {!period.hasExam ? <Badge tone="neutral">без экзамена</Badge> : null}
      </div>
      {period.mentors.length > 0 ? (
        <p className="text-[13px] text-ink-secondary"><span className="text-ink-muted">Вели группу:</span> {period.mentors.join(', ')}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] text-warning"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />В CRM у группы нет ментора за этот период — отчёт некому сдать</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Средний итог" value={s.averageTotal === null || s.averageTotal === undefined ? '—' : String(s.averageTotal)} hint={`по ${String(s.students)} студ.`} />
        <Zones passed={s.passed} support={s.support} risk={s.risk} />
        <Stat label="Посещаемость" value={percent(s.attendanceRate)} hint="по заполненным дням" />
        <Stat label="Журнал заполнен" value={percent(s.fillRate)} />
      </div>
      {s.partialStudents + s.emptyStudents > 0 ? (
        <p className="text-[12.5px] text-ink-muted">
          В средний идут только полностью заполненные недели.
          {s.partialStudents > 0 ? ` Заполнено не до конца: ${String(s.partialStudents)} студ.` : ''}
          {s.emptyStudents > 0 ? ` Не заполнено совсем: ${String(s.emptyStudents)} студ.` : ''}
        </p>
      ) : null}
      {period.students.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="Нет студентов" description="В эту неделю в группе никого не было." />
      ) : (
        <ul className="divide-y divide-divider">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Средний балл" value={overall.averageTotal === null || overall.averageTotal === undefined ? '—' : String(overall.averageTotal)} hint={`закрытых недель: ${String(overall.periods)}`} />
        <Zones passed={overall.passed} support={overall.support} risk={overall.risk} />
        <Stat label="Посещаемость" value={percent(overall.attendanceRate)} hint="по заполненным дням" />
        <Stat label="Журнал заполнен" value={percent(overall.fillRate)} />
      </div>
      <ul className="divide-y divide-divider">
        {overall.studentResults.map((s) => {
          const zone = s.zone ? ZONE[s.zone] : undefined;
          const notFull = s.partialWeeks + s.emptyWeeks;
          return (
            <li key={s.studentId} className="flex items-center gap-3 py-2.5">
              <span className={`w-14 shrink-0 text-right text-[18px] font-semibold tabular-nums ${zoneText(s.zone)}`}>{s.averageTotal ?? '—'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{s.fullName}</span>
                <span className="block text-[12px] text-ink-muted">
                  в группе {s.weeks} нед. · заполнено полностью {s.fullWeeks}
                  {notFull > 0 ? ` · не до конца или пусто ${String(notFull)}` : ''}
                  {s.fullWeeks > 1 ? ` · от ${String(s.minTotal)} до ${String(s.maxTotal)}` : ''}
                  {s.absent > 0 ? ` · пропусков ${String(s.absent)}` : ''}
                  {s.late > 0 ? ` · опозданий ${String(s.late)}` : ''}
                </span>
              </span>
              {zone ? <Badge tone={zone.tone}>{zone.label}</Badge> : <Badge tone="neutral">нет полных недель</Badge>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted"><GraduationCap className="h-4 w-4" aria-hidden="true" />Менторы по датам</h3>
            {data.mentors.length === 0 ? (
              <p className="text-[13px] text-warning">В CRM у группы нет ни одного ментора.</p>
            ) : (
              <ul className="space-y-1 text-[13.5px]">
                {data.mentors.map((m) => (
                  <li key={`${String(m.id)}-${m.from}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{m.fullName}</span>
                    <Badge tone={m.role === 'Снят' ? 'neutral' : m.role === 'Помогает' ? 'info' : 'brand'}>{m.role}</Badge>
                    <span className="text-ink-muted">{formatDay(m.from, true)} — {m.to ? formatDay(m.to, true) : '…'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.journalUnavailable ? null : (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted"><Sigma className="h-4 w-4" aria-hidden="true" />Итог по закрытым неделям</h3>
              <OverallView overall={data.overall} />
            </section>
          )}

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted"><Clock3 className="h-4 w-4" aria-hidden="true" />Журнал по неделям</h3>
            {data.journalUnavailable ? (
              <p className="rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning">{data.journalUnavailable}</p>
            ) : (
              <>
                <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Периоды журнала">
                  {data.periods.map((p) => {
                    const active = p.week === period?.week;
                    return (
                      <button
                        key={p.week}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => { setWeek(p.week); }}
                        className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-medium transition ${
                          active ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-secondary hover:border-brand/40'
                        }`}
                      >
                        {periodTitle(p.label)}{p.summary.issueCount > 0 ? ' ⚠' : ''}
                      </button>
                    );
                  })}
                </div>
                {period ? <PeriodView period={period} /> : <p className="text-[13px] text-ink-muted">Периодов пока нет.</p>}
              </>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted"><UserMinus className="h-4 w-4" aria-hidden="true" />Состав группы</h3>
            <ul className="divide-y divide-divider text-[13.5px]">
              {data.students.map((s) => {
                const status = STUDENT_STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const };
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.fullName}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-[12px] text-ink-muted">с {formatDay(s.joinedOn, true)}{s.leftOn ? ` по ${formatDay(s.leftOn, true)}` : ''}</span>
                    {s.note ? <span className="w-full text-[12px] text-ink-secondary">{s.note}</span> : null}
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
