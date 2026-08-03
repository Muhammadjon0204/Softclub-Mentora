import { AlertTriangle } from 'lucide-react';

import { getProblemCode, getTraceId } from '../../api/problemDetails';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

const FALLBACK_MESSAGE = 'Не удалось загрузить данные';

/** Единое состояние ошибки: код ProblemDetails, кнопка повтора, traceId для поддержки. */
export function ErrorState({ error, onRetry, title = FALLBACK_MESSAGE }: ErrorStateProps): JSX.Element {
  const code = getProblemCode(error);
  const traceId = getTraceId(error);

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-[13px] text-ink-muted">
          {code !== null ? `Код ошибки: ${code}` : 'Проверьте соединение и повторите попытку'}
        </p>
        {traceId !== null ? (
          <p className="text-[12px] text-ink-disabled">
            ID запроса: <span className="font-mono">{traceId}</span>
          </p>
        ) : null}
      </div>
      {onRetry !== undefined ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
