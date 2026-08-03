import { http } from 'msw';

import { getRecentSystemEvents, getServiceHealth } from '../domain/health';
import { allAuditLog } from '../domain/auditLog';
import {
  computeActivitySeries,
  computeBranchHealthRows,
  computeCategoryHealthRows,
  computeDashboardKpis,
  computeRoleDistribution,
} from '../domain/reports';
import { authenticateAdmin, correlationIdOf, jsonOk } from './shared';

const route = (path: string): string => `*/api/v1/${path}`;

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

    return jsonOk(
      {
        scope: { branchId: effectiveBranchId, isAllBranches },
        kpis: computeDashboardKpis(scope),
        activitySeries: computeActivitySeries(scope, 7),
        roleDistribution: computeRoleDistribution(scope),
        branchHealth: isAllBranches ? computeBranchHealthRows() : null,
        categoryHealth: computeCategoryHealthRows(effectiveBranchId),
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
      },
      correlationId,
    );
  }),
];
