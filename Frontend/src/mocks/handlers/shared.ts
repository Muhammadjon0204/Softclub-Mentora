import { HttpResponse } from 'msw';

import { createCorrelationId } from '../../lib/correlationId';
import { findBranch } from '../domain/organization';
import { verifyAccessToken } from '../tokens';
import type { MockUser } from '../db';

/**
 * Общая инфраструктура MSW-хендлеров admin-домена: аутентификация,
 * вычисление effective branch scope из `X-MTF-Branch-Id` (ТЗ 2.2, раздел 38.3)
 * и построение ProblemDetails-ответов для кодов, которых нет в auth-контракте.
 */

export type AdminErrorCode =
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_VERSION_MISMATCH'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONCURRENCY_CONFLICT'
  | 'BRANCH_CONTEXT_REQUIRED'
  | 'SCOPE_OVERRIDE_FORBIDDEN'
  | 'BRANCH_ALREADY_EXISTS'
  | 'BRANCH_HAS_ACTIVE_USERS'
  | 'HEAD_OFFICE_DEACTIVATION_FORBIDDEN'
  | 'CATEGORY_HAS_ACTIVE_USERS'
  | 'ACTIVE_LEAD_ALREADY_EXISTS'
  | 'CROSS_SCOPE_REFERENCE';

const STATUS_BY_CODE: Record<AdminErrorCode, number> = {
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_VERSION_MISMATCH: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  CONCURRENCY_CONFLICT: 409,
  BRANCH_CONTEXT_REQUIRED: 400,
  SCOPE_OVERRIDE_FORBIDDEN: 403,
  BRANCH_ALREADY_EXISTS: 409,
  BRANCH_HAS_ACTIVE_USERS: 409,
  HEAD_OFFICE_DEACTIVATION_FORBIDDEN: 409,
  CATEGORY_HAS_ACTIVE_USERS: 409,
  ACTIVE_LEAD_ALREADY_EXISTS: 409,
  CROSS_SCOPE_REFERENCE: 409,
};

export interface AdminProblemInit {
  code: AdminErrorCode;
  detail: string;
  instance: string;
  correlationId: string;
  errors?: Record<string, string[]>;
}

export function adminProblem(init: AdminProblemInit) {
  const status = STATUS_BY_CODE[init.code];
  return HttpResponse.json(
    {
      type: `https://mentortaskflow.example/problems/${init.code.toLowerCase().replace(/_/g, '-')}`,
      title: init.code,
      status,
      code: init.code,
      detail: init.detail,
      instance: init.instance,
      traceId: init.correlationId,
      errors: init.errors ?? {},
    },
    {
      status,
      headers: { 'Content-Type': 'application/problem+json', 'X-Correlation-Id': init.correlationId },
    },
  );
}

export function correlationIdOf(request: Request): string {
  const header = request.headers.get('X-Correlation-Id');
  return header !== null && header.length > 0 ? header : createCorrelationId();
}

export function jsonOk<T extends Record<string, unknown> | unknown[]>(
  body: T,
  correlationId: string,
  status = 200,
) {
  return HttpResponse.json(body, { status, headers: { 'X-Correlation-Id': correlationId } });
}

export interface EffectiveScope {
  user: MockUser;
  /** `null` означает режим «Все филиалы» (только Organization Admin, только чтение). */
  effectiveBranchId: string | null;
  isAllBranches: boolean;
}

export type AuthResult =
  | { ok: true; scope: EffectiveScope }
  | { ok: false; response: ReturnType<typeof adminProblem> };

/**
 * Проверяет Bearer-токен, роль Admin и заголовок `X-MTF-Branch-Id`.
 *
 * Правила (ТЗ 2.2, раздел 38.3):
 *  - Branch Admin никогда не отправляет заголовок — при наличии 403 SCOPE_OVERRIDE_FORBIDDEN;
 *  - Organization Admin может выбрать любой Branch своей Organization или не выбрать
 *    ни одного (режим «Все филиалы», только для чтения);
 *  - несуществующий/чужой Branch в заголовке -> 404, чтобы не подтверждать его существование.
 */
export function authenticateAdmin(request: Request, instance: string): AuthResult {
  const correlationId = correlationIdOf(request);
  const verdict = verifyAccessToken(request.headers.get('Authorization'));

  if (!verdict.ok) {
    return {
      ok: false,
      response: adminProblem({
        code: verdict.code,
        detail: 'Требуется действующий access-токен',
        instance,
        correlationId,
      }),
    };
  }

  if (verdict.user.role !== 'Admin') {
    return {
      ok: false,
      response: adminProblem({
        code: 'FORBIDDEN',
        detail: 'Доступно только роли Admin',
        instance,
        correlationId,
      }),
    };
  }

  const headerBranchId = request.headers.get('X-MTF-Branch-Id');

  if (verdict.user.adminScope === 'Branch') {
    if (headerBranchId !== null) {
      return {
        ok: false,
        response: adminProblem({
          code: 'SCOPE_OVERRIDE_FORBIDDEN',
          detail: 'Branch Admin не может передавать X-MTF-Branch-Id',
          instance,
          correlationId,
        }),
      };
    }
    return {
      ok: true,
      scope: { user: verdict.user, effectiveBranchId: verdict.user.branchId, isAllBranches: false },
    };
  }

  // adminScope === 'Organization'
  if (headerBranchId === null) {
    return { ok: true, scope: { user: verdict.user, effectiveBranchId: null, isAllBranches: true } };
  }

  const branch = findBranch(headerBranchId);
  if (branch === undefined || branch.organizationId !== verdict.user.organizationId) {
    // Не 403 — существование чужого/несуществующего филиала не подтверждаем.
    return {
      ok: false,
      response: adminProblem({
        code: 'RESOURCE_NOT_FOUND',
        detail: 'Филиал не найден',
        instance,
        correlationId,
      }),
    };
  }

  return {
    ok: true,
    scope: { user: verdict.user, effectiveBranchId: branch.id, isAllBranches: false },
  };
}

/** Мутации запрещены в режиме «Все филиалы» (ТЗ TEN-034) — общая проверка для всех write-хендлеров. */
export function requireSingleBranch(
  scope: EffectiveScope,
  instance: string,
  correlationId: string,
): ReturnType<typeof adminProblem> | null {
  if (scope.effectiveBranchId === null) {
    return adminProblem({
      code: 'BRANCH_CONTEXT_REQUIRED',
      detail: 'Выберите филиал для выполнения этого действия',
      instance,
      correlationId,
    });
  }
  return null;
}

export interface PageParams {
  page: number;
  pageSize: number;
}

export function readPageParams(url: URL): PageParams {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? '20') || 20));
  return { page, pageSize };
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export function paginate<T>(items: T[], params: PageParams): PagedResult<T> {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / params.pageSize));
  const start = (params.page - 1) * params.pageSize;
  return {
    items: items.slice(start, start + params.pageSize),
    page: params.page,
    pageSize: params.pageSize,
    totalCount,
    totalPages,
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
