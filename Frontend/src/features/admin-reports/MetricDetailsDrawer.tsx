import { Drawer } from '../../shared/overlays';
import { ErrorState } from '../../shared/ui/ErrorState';
import { METRIC_DEFINITIONS, REPORT_PERIOD_LABEL, formatRate, metricBreakdown } from './reportPresentation';
import type { MetricKey } from './reportPresentation';

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 max-w-[65%] text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export interface MetricDetailsDrawerProps {
  metricKey: MetricKey | null;
  onClose: () => void;
  scopeLabel: string;
}

/** Формулы дословно из ТЗ (раздел 27 промпта) — числитель/знаменатель, а не выдуманные проценты. */
export function MetricDetailsDrawer({ metricKey, onClose, scopeLabel }: MetricDetailsDrawerProps): JSX.Element {
  const definition = metricKey !== null ? METRIC_DEFINITIONS[metricKey] : undefined;
  const open = metricKey !== null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={definition?.label ?? 'Метрика'}
      description={definition !== undefined ? REPORT_PERIOD_LABEL : undefined}
      size="md"
    >
      {metricKey === null ? null : definition === undefined ? (
        <ErrorState title="Метрика не найдена" error={null} />
      ) : (
        <div className="space-y-5">
          <p className="text-[13px] leading-[20px] text-ink-secondary">{definition.definition}</p>

          <div className="rounded-control border border-line bg-surface-muted p-3.5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">Формула</p>
            <p className="mt-1 font-mono text-[12.5px] leading-[18px] text-ink">{definition.formula}</p>
          </div>

          {definition.kind === 'rate' ? (
            <dl className="divide-y divide-divider">
              <DetailRow label={definition.numeratorLabel} value={String(definition.numerator)} />
              <DetailRow label={definition.denominatorLabel} value={String(definition.denominator)} />
              <DetailRow label="Значение" value={formatRate(definition.numerator, definition.denominator)} />
              <DetailRow label="Период" value={REPORT_PERIOD_LABEL} />
              <DetailRow label="Область" value={scopeLabel} />
            </dl>
          ) : (
            <dl className="divide-y divide-divider">
              <DetailRow label="Медиана" value={definition.medianLabel} />
              <DetailRow label="Среднее" value={definition.meanLabel} />
              <DetailRow label="Период" value={REPORT_PERIOD_LABEL} />
              <DetailRow label="Область" value={scopeLabel} />
            </dl>
          )}

          <div>
            <h4 className="mb-2.5 text-[12.5px] font-semibold text-ink-secondary">Разбивка</h4>
            <ul className="space-y-2.5">
              {metricBreakdown(definition.key).map((entry) => (
                <li key={entry.label}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-secondary">{entry.label}</span>
                    <span className="font-medium tabular-nums text-ink">{entry.value}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.min(entry.value, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[12px] leading-[17px] text-ink-muted">{definition.limitations}</p>
        </div>
      )}
    </Drawer>
  );
}
