import axios from 'axios';

import type { components } from './generated/auth-api';

/** RFC 7807-совместимое тело ошибки. Единственный источник решений на клиенте — `code`. */
export type ApiProblemDetails = components['schemas']['ProblemDetails'];

/** Полный перечень кодов из OpenAPI-контракта. */
export type AuthErrorCode = components['schemas']['AuthErrorCode'];

export const AUTH_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSE_DETECTED: 'REFRESH_TOKEN_REUSE_DETECTED',
  CSRF_VALIDATION_FAILED: 'CSRF_VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_VERSION_MISMATCH: 'TOKEN_VERSION_MISMATCH',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SECURITY_TOKEN_INVALID: 'SECURITY_TOKEN_INVALID',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
} as const satisfies Record<AuthErrorCode, AuthErrorCode>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isProblemDetails(value: unknown): value is ApiProblemDetails {
  if (!isRecord(value)) return false;

  return (
    typeof value['type'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['status'] === 'number' &&
    typeof value['code'] === 'string' &&
    typeof value['detail'] === 'string' &&
    typeof value['instance'] === 'string' &&
    typeof value['traceId'] === 'string' &&
    isRecord(value['errors'])
  );
}

/** Достаёт ProblemDetails из ошибки axios либо из уже распакованного тела. */
export function toProblemDetails(error: unknown): ApiProblemDetails | null {
  if (isProblemDetails(error)) return error;
  if (axios.isAxiosError(error) && isProblemDetails(error.response?.data)) {
    return error.response.data;
  }
  return null;
}

/** `null`, если сервер не прислал ProblemDetails (сеть, 5xx без тела, CORS). */
export function getProblemCode(error: unknown): AuthErrorCode | null {
  return toProblemDetails(error)?.code ?? null;
}

export function getValidationErrors(error: unknown): Record<string, string[]> {
  const problem = toProblemDetails(error);
  if (problem === null) return {};
  return problem.errors;
}

/** Секунды из заголовка `Retry-After`. Поддерживает и число, и HTTP-дату. */
export function getRetryAfter(error: unknown): number | null {
  if (!axios.isAxiosError(error) || error.response === undefined) return null;

  const raw: unknown = error.response.headers['retry-after'];
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const timestamp = Date.parse(String(raw));
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

/** Идентификатор для обращения в поддержку: из тела либо из заголовка ответа. */
export function getTraceId(error: unknown): string | null {
  const problem = toProblemDetails(error);
  if (problem !== null) return problem.traceId;

  if (axios.isAxiosError(error) && error.response !== undefined) {
    const header: unknown = error.response.headers['x-correlation-id'];
    if (typeof header === 'string' && header.length > 0) return header;
  }
  return null;
}

/** Запрос не дошёл до сервера: оффлайн, DNS, таймаут, отменённый CORS-preflight. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export function getStatus(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return error.response?.status ?? null;
}
