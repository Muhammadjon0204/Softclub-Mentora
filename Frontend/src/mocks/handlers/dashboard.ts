import { http } from 'msw';

import { getRecentSystemEvents, getServiceHealth } from '../domain/health';
import { allAuditLog } from '../domain/auditLog';
import {
  computeActivitySeries,
  computeBestBranchInsight,
  computeBranchHealthRows,
  computeCategoryHealthRows,
  computeDashboardKpis,
  computeRecentAssignmentActivity,
  computeRoleDistribution,
  computeTopMentors,
  computeUpcomingDeadlines,
  type ReportPeriod,
} from '../domain/reports';
import { authenticateAdmin, correlationIdOf, jsonOk } from './shared';

const route = (path: string): string => `*/api/v1/${path}`;

const REPORT_PERIODS: readonly ReportPeriod[] = ['all', '1m', '3m', '6m', '1y'];

/** Как и `parseDashboardPeriod` на фронтенде: неизвестное/отсутствующее значение → `1m`. */
function readPeriod(url: URL): ReportPeriod {
  const raw = url.searchParams.get('period');
  return raw !== null && (REPORT_PERIODS as readonly string[]).includes(raw) ? (raw as ReportPeriod) : '1m';
}

/**
 * GET /api/v1/admin/dashboard — агрегирующий endpoint для страницы обзора.
 *
 * В реальном backend это, вероятнее всего, композиция нескольких вызовов
 * (`/reports/team`, `/admin/audit-log`, `/health/ready`) — здесь они сведены
 * в один ответ намеренно, чтобы страница дашборда не плодила пять параллельных
 * запросов ради пяти виджетов на одном экране.
 */
export const dashboardHandlers = [
  http.get(route('admin/dashboard'), ({ request }) => {
    const instance = '/api/v1/admin/dashboard';
    const auth = authenticateAdmin(request, instance);
    if (!auth.ok) return auth.response;

    const correlationId = correlationIdOf(request);
    const { effectiveBranchId, isAllBranches } = auth.scope;
    const scope = { branchId: effectiveBranchId };
    const period = readPeriod(new URL(request.url));

    return jsonOk(
      {
        scope: { branchId: effectiveBranchId, isAllBranches },
        period,
        kpis: computeDashboardKpis(scope),
        activitySeries: computeActivitySeries(scope, period),
        roleDistribution: computeRoleDistribution(scope),
        branchHealth: isAllBranches ? computeBranchHealthRows() : null,
        categoryHealth: computeCategoryHealthRows(effectiveBranchId, period),
        recentAudit: allAuditLog()
          .filter(
            (entry) =>
              effectiveBranchId === null || entry.branchId === effectiveBranchId || entry.branchId === null,
          )
          .slice(0, 6)
          .map((entry) => ({
            id: entry.id,
            at: new Date(entry.at).toISOString(),
            branchId: entry.branchId,
            actorLabel: entry.actorLabel,
            action: entry.action,
            entityType: entry.entityType,
            result: entry.result,
          })),
        systemHealth: {
          services: getServiceHealth().map((service) => ({
            id: service.id,
            name: service.name,
            status: service.status,
            latencyMs: service.latencyMs,
            lastCheckedAt: new Date(service.lastCheckedAt).toISOString(),
            message: service.message,
          })),
          recentEvents: getRecentSystemEvents().map((event) => ({
            id: event.id,
            at: new Date(event.at).toISOString(),
            level: event.level,
            message: event.message,
          })),
        },
        bestBranchInsight: computeBestBranchInsight(scope, isAllBranches, period),
        topMentors: computeTopMentors(scope, 5, period),
        upcomingDeadlines: computeUpcomingDeadlines(scope, 5, period).map((row) => ({
          id: row.id,
          title: row.title,
          mentorName: row.mentorName,
          dueAt: new Date(row.dueAt).toISOString(),
        })),
        recentAssignmentActivity: computeRecentAssignmentActivity(scope, 6, period).map((row) => ({
          id: row.id,
          at: new Date(row.at).toISOString(),
          mentorName: row.mentorName,
          leadName: row.leadName,
          categoryName: row.categoryName,
          title: row.title,
          status: row.status,
        })),
      },
      correlationId,
    );
  }),
];
