import type { CrmPeriod } from '../../api/admin/crm';
import { ZONE, percent, periodTitle, zoneText } from './crmPresentation';

/** Изменение к прошлой неделе: ▲ +5 зелёным, ▼ −3 красным, «=» серым; пусто, если сравнивать не с чем. */
function Delta({ now, before, suffix = '', invert = false, compact = false }: {
  now: number | null | undefined;
  before: number | null | undefined;
  suffix?: string;
  invert?: boolean;
  compact?: boolean;
}): JSX.Element | null {
  if (now === null || now === undefined || before === null || before === undefined) {
    return null;
  }

  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) {
    return <span className="text-[12px] font-medium text-ink-muted">{compact ? '=' : '= как на прошлой'}</span>;
  }

  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-[12px] font-semibold tabular-nums ${good ? 'text-success' : 'text-danger'}`}>
      {diff > 0 ? '▲ +' : '▼ −'}{Math.abs(diff)}{suffix}
    </span>
  );
}

function Kpi({ label, value, delta, hint }: { label: string; value: React.ReactNode; delta?: React.ReactNode; hint?: string }): JSX.Element {
  return (
    <div className="px-4 py-3">
      <p className="text-[11.5px] text-ink-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-7 tabular-nums text-ink">{value}</span>
        {delta}
      </p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Сводка отчёта, которую считает код, а не ИИ: средний балл группы, зоны и посещаемость с изменением к
 * прошлой неделе, и студенты по местам — было → стало.
 */
export function CrmReportSummary({ period, previous }: { period: CrmPeriod; previous?: CrmPeriod | null }): JSX.Element {
  const s = period.summary;
  const p = previous?.summary;
  const before = new Map((previous?.students ?? []).filter((x) => x.fill === 'Full').map((x) => [x.studentId, x.total]));
  const ranked = period.students.filter((x) => x.fill !== 'Empty').slice().sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-control border border-line sm:grid-cols-4 [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+2)]:border-l sm:[&>*:nth-child(n+3)]:border-t-0 [&>*]:border-divider">
        <Kpi
          label="Средний балл группы"
          value={s.averageTotal ?? '—'}
          delta={<Delta now={s.averageTotal} before={p?.averageTotal} compact />}
          hint={p ? `прошлая неделя: ${p.averageTotal ?? '—'}` : 'прошлой недели нет'}
        />
        <Kpi
          label="80+ · 70–79 · ниже 70"
          value={
            <>
              <span className="text-success">{s.passed}</span><span className="px-1 text-[16px] text-ink-muted">·</span>
              <span className="text-warning">{s.support}</span><span className="px-1 text-[16px] text-ink-muted">·</span>
              <span className="text-danger">{s.risk}</span>
            </>
          }
          hint={p ? `было: ${String(p.passed)} · ${String(p.support)} · ${String(p.risk)}` : undefined}
        />
        <Kpi
          label="Посещаемость"
          value={percent(s.attendanceRate)}
          delta={<Delta now={s.attendanceRate} before={p?.attendanceRate} suffix="%" compact />}
          hint={p ? `прошлая неделя: ${percent(p.attendanceRate)}` : undefined}
        />
        <Kpi label="Студентов в отчёте" value={s.students} hint={previous ? `${periodTitle(period.label)} против ${periodTitle(previous.label).toLowerCase()}` : periodTitle(period.label)} />
      </div>

      {/* На телефоне таблица прокручивается вбок, а не сжимает имена до «Gulmatov M…». */}
      <div className="overflow-x-auto rounded-control border border-line">
        <table className="w-full min-w-[560px] table-fixed text-left text-[13px]">
          <colgroup>
            <col className="w-10" />
            <col />
            {previous ? <col className="w-[84px]" /> : null}
            <col className="w-[92px]" />
            {previous ? <col className="w-[84px]" /> : null}
            <col className="w-[136px]" />
          </colgroup>
          <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-[0.06em] text-ink-muted">
            <tr>
              <th className="w-10 px-3 py-2 text-right font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Студент</th>
              {previous ? <th className="px-3 py-2 text-right font-semibold">Было</th> : null}
              <th className="px-3 py-2 text-right font-semibold">Стало</th>
              {previous ? <th className="px-3 py-2 text-right font-semibold">±</th> : null}
              <th className="px-3 py-2 font-semibold">Зона</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {ranked.map((st, index) => {
              const was = before.get(st.studentId);
              const zone = st.fill === 'Full' ? ZONE[st.zone] : undefined;
              return (
                <tr key={st.studentId}>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{index + 1}</td>
                  <td className="truncate px-3 py-2 font-medium text-ink" title={st.fullName}>{st.fullName}</td>
                  {previous ? <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{was ?? '—'}</td> : null}
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${st.fill === 'Full' ? zoneText(st.zone) : 'text-ink-muted'}`}>{st.total}</td>
                  {previous ? (
                    <td className="px-3 py-2 text-right">
                      {was === undefined ? <span className="text-[12px] text-ink-muted">—</span> : <Delta now={st.total} before={was} compact />}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    {zone ? (
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium ${zone.text}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{zone.label}
                      </span>
                    ) : <span className="text-[12px] text-ink-muted">неделя не закрыта</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
