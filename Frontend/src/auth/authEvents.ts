import { AUTH_ERROR_CODE, getProblemCode } from '../api/problemDetails';

/**
 * Шина auth-событий.
 *
 * Нужна, чтобы axios-интерцептор мог сообщить о завершении сессии, не импортируя
 * React-контекст и не создавая цикл `client.ts -> AuthProvider -> client.ts`.
 * AuthProvider — единственный подписчик, который чистит состояние и делает redirect.
 */

/** Попадает в `/login?reason=...` и определяет текст баннера. */
export type SessionEndReason = 'session-expired' | 'session-compromised' | 'csrf-failed';

export interface AuthEventPayload {
  sessionExpired: { reason: SessionEndReason };
  tokenReuseDetected: Record<string, never>;
  loggedOut: Record<string, never>;
}

export type AuthEventName = keyof AuthEventPayload;

type Listener<TName extends AuthEventName> = (payload: AuthEventPayload[TName]) => void;

const listeners: { [TName in AuthEventName]: Set<Listener<TName>> } = {
  sessionExpired: new Set(),
  tokenReuseDetected: new Set(),
  loggedOut: new Set(),
};

export const authEvents = {
  on<TName extends AuthEventName>(name: TName, listener: Listener<TName>): () => void {
    listeners[name].add(listener);
    return () => {
      listeners[name].delete(listener);
    };
  },

  emit<TName extends AuthEventName>(name: TName, payload: AuthEventPayload[TName]): void {
    for (const listener of [...listeners[name]]) listener(payload);
  },
};

/** Классификация провала refresh для баннера на /login. */
export function sessionEndReasonFromError(error: unknown): SessionEndReason {
  switch (getProblemCode(error)) {
    case AUTH_ERROR_CODE.REFRESH_TOKEN_REUSE_DETECTED:
      return 'session-compromised';
    case AUTH_ERROR_CODE.CSRF_VALIDATION_FAILED:
      return 'csrf-failed';
    default:
      return 'session-expired';
  }
}

/** Единая точка оповещения о том, что сессия закончилась. */
export function notifySessionEnded(error: unknown): void {
  const reason = sessionEndReasonFromError(error);
  if (reason === 'session-compromised') {
    authEvents.emit('tokenReuseDetected', {});
    return;
  }
  authEvents.emit('sessionExpired', { reason });
}
