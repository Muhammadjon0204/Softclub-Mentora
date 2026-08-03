import { getTraceId } from '../../api/problemDetails';
import { getAuthErrorMessage, shouldShowTraceId } from './authErrorMessages';

interface AuthErrorProps {
  error: unknown;
  /** Секунды активного countdown — попадают в текст RATE_LIMIT_EXCEEDED. */
  retryAfterSeconds?: number | null;
}

/**
 * Блок ошибки под формой.
 *
 * Никогда не показывает стек, тело ответа или служебные детали — только
 * человеческий текст по `ProblemDetails.code` и, для неизвестных ошибок, traceId.
 */
export function AuthError({ error, retryAfterSeconds = null }: AuthErrorProps): JSX.Element | null {
  if (error === null || error === undefined) return null;

  const message = getAuthErrorMessage(error, { retryAfterSeconds });
  const traceId = shouldShowTraceId(error) ? getTraceId(error) : null;

  return (
    <div
      role="alert"
      className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
    >
      <p className="flex items-start gap-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="mt-0.5 h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5" strokeLinecap="round" />
          <path d="M12 16.2h.01" strokeLinecap="round" />
        </svg>
        <span>{message}</span>
      </p>
      {traceId !== null ? (
        <p className="mt-1.5 pl-6 text-xs text-rose-500">
          Код обращения: <span className="font-mono">{traceId}</span>
        </p>
      ) : null}
    </div>
  );
}
