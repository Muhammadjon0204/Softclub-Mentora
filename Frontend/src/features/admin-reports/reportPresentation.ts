import { PREVIEW_BRANCH_COMPARISON, PREVIEW_CATEGORY_RESULTS, PREVIEW_REPORT_PERIOD_LABEL } from '../../mocks/ui-preview/reports.preview';

/**
 * Формулы взяты дословно из ТЗ (раздел 21.2–21.4, ANA-004/008/009) — не придуманы.
 * `completion` — производная метрика (`ApprovedAssignments / TotalAssignments`),
 * составленная из двух формально определённых в ТЗ величин; в ТЗ нет отдельно
 * названной `CompletionRate`, поэтому это явно помечено в `limitations`.
 */
export type MetricKey = 'completion' | 'overdue' | 'firstPass' | 'reviewTime';

interface RateMetricDefinition {
  kind: 'rate';
  key: MetricKey;
  label: string;
  definition: string;
  formula: string;
  numeratorLabel: string;
  denominatorLabel: string;
  numerator: number;
  denominator: number;
  limitations: string;
}

interface DurationMetricDefinition {
  kind: 'duration';
  key: MetricKey;
  label: string;
  definition: string;
  formula: string;
  medianLabel: string;
  meanLabel: string;
  limitations: string;
}

export type MetricDefinition = RateMetricDefinition | DurationMetricDefinition;

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  completion: {
    kind: 'rate',
    key: 'completion',
    label: 'Процент завершения',
    definition: 'Доля назначенных заданий периода, доведённых до статуса Approved.',
    formula: '100 × ApprovedAssignments / TotalAssignments',
    numeratorLabel: 'ApprovedAssignments — одобрено за период',
    denominatorLabel: 'TotalAssignments — назначено за период (по AssignedAt)',
    numerator: 109,
    denominator: 140,
    limitations: 'Производная метрика: в ТЗ формально определены TotalAssignments и ApprovedAssignments (раздел 21.2), а не отдельная CompletionRate.',
  },
  overdue: {
    kind: 'rate',
    key: 'overdue',
    label: 'Доля просроченных',
    definition: 'OverdueRate — доля заданий периода, у которых была зафиксирована хотя бы одна просрочка.',
    formula: '100 × COUNT(DISTINCT Assignment WHERE OverdueAt IS NOT NULL) / TotalAssignments',
    numeratorLabel: 'Уникальные Assignment с OverdueAt (не события MarkedOverdue)',
    denominatorLabel: 'TotalAssignments — назначено за период',
    numerator: 12,
    denominator: 140,
    limitations: 'Считаются уникальные задания, а не события MarkedOverdue — повторная просрочка после доработки не задваивает числитель (ANA-009).',
  },
  firstPass: {
    kind: 'rate',
    key: 'firstPass',
    label: 'Одобрено с первой попытки',
    definition: 'FirstPassApprovalRate — доля Approved-заданий, где была ровно одна Submission и её единственный Review — Approved.',
    formula: '100 × (Approved, 1 Submission, Review=Approved) / ApprovedAssignments',
    numeratorLabel: 'Approved с единственной Submission и Review=Approved',
    denominatorLabel: 'ApprovedAssignments — одобрено за период',
    numerator: 74,
    denominator: 109,
    limitations: 'При ApprovedAssignments = 0 метрика возвращает «Недостаточно данных», а не 0% (ANA-004).',
  },
  reviewTime: {
    kind: 'duration',
    key: 'reviewTime',
    label: 'Среднее время проверки',
    definition: 'FinalReviewTime — время между отправкой последней Submission и решением Approved-Review.',
    formula: 'медиана и среднее ApprovedReview.CreatedAt − LastSubmission.SubmittedAt',
    medianLabel: '2.4 дня (медиана)',
    meanLabel: '3.1 дня (среднее)',
    limitations: 'Основное отображаемое значение — медиана (ANA-008): одна забытая на проверке задача искажает среднее.',
  },
};

/** ANA-004: знаменатель 0 → «Недостаточно данных», не 0% и не NaN. */
export function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return 'Недостаточно данных';
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

export function metricBreakdown(key: MetricKey): { label: string; value: number }[] {
  if (key === 'completion' || key === 'overdue') {
    return PREVIEW_CATEGORY_RESULTS.map((entry) => ({ label: entry.categoryName, value: key === 'completion' ? entry.completionPct : entry.overduePct }));
  }
  return PREVIEW_BRANCH_COMPARISON.map((entry) => ({ label: entry.branchName, value: entry.completionPct }));
}

export const REPORT_PERIOD_LABEL = PREVIEW_REPORT_PERIOD_LABEL;
