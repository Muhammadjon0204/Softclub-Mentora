import {
  DefaultHttpClient,
  HttpError,
  HubConnectionBuilder,
  LogLevel,
  NullLogger,
  type HttpRequest,
  type HttpResponse,
  type HubConnection,
} from '@microsoft/signalr';
import type { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { notifySessionEnded } from '../auth/authEvents';
import { refreshAccessToken } from '../auth/refreshCoordinator';
import { getAccessToken } from '../auth/tokenStore';

export const REALTIME_HUB_PATH = '/api/v1/realtime';

/**
 * Всё, кроме сессии, живое: на событие сервера запросы помечаются устаревшими —
 * смонтированные тихо перезапрашиваются в фоне (старые данные остаются на экране
 * до ответа), остальные — при следующем открытии. Список исключений, а не список
 * «живых» страниц: новая страница становится живой сама, её не надо не забыть
 * сюда вписать. `auth/*` не трогаем — профиль сессии меняется только при входе.
 */
const STATIC_QUERY_ROOTS: ReadonlySet<unknown> = new Set(['auth']);

export function isLiveQueryKey(queryKey: readonly unknown[]): boolean {
  return !STATIC_QUERY_ROOTS.has(queryKey[0]);
}

// Пачку событий (например массовую публикацию) сворачиваем в один перезапрос:
// ждём 250 мс тишины, но не дольше секунды от первого события.
const DEBOUNCE_MS = 250;
const MAX_WAIT_MS = 1_000;
const TOKEN_REFRESH_MARGIN_MS = 30_000;
const MAX_RETRY_DELAY_MS = 30_000;

export function createRefetchScheduler(queryClient: QueryClient): { schedule: () => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstEventAt: number | null = null;

  const flush = (): void => {
    timer = undefined;
    firstEventAt = null;
    void queryClient.invalidateQueries({ predicate: (query) => isLiveQueryKey(query.queryKey) });
  };

  return {
    schedule() {
      const now = Date.now();
      firstEventAt ??= now;
      clearTimeout(timer);
      timer = setTimeout(flush, Math.max(0, Math.min(DEBOUNCE_MS, firstEventAt + MAX_WAIT_MS - now)));
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}

function retryDelayMs(attempt: number): number {
  const base = Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** attempt);
  // Джиттер: после перезапуска API все вкладки не должны ломиться обратно в одну и ту же секунду.
  return base / 2 + Math.random() * (base / 2);
}

function tokenExpiresAtMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (payload === undefined) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1_000 : null;
  } catch {
    return null;
  }
}

/**
 * Сервер закрывает соединение, когда истекает токен, с которым оно открылось, —
 * поэтому каждое (пере)подключение берёт свежий токен, а не тот, что лежит в памяти.
 * `force` — сервер уже отверг текущий токен раньше срока (смена роли или пароля,
 * деактивация): ждать его истечения бессмысленно, только refresh.
 */
async function freshAccessToken(force: boolean): Promise<string> {
  const token = getAccessToken();
  const expiresAt = token === null ? null : tokenExpiresAtMs(token);
  if (!force && token !== null && expiresAt !== null && expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) return token;

  try {
    return await refreshAccessToken();
  } catch (error: unknown) {
    // Сервер отказал в refresh — сессия действительно закончена, так же как в apiClient.
    // Сетевую ошибку сессией не считаем: подключение просто повторится позже.
    if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      notifySessionEnded(error);
    }
    throw error;
  }
}

/** Замечает 401 от сервера: SignalR оборачивает его в ошибку без статуса, по которой не понять причину. */
class UnauthorizedAwareHttpClient extends DefaultHttpClient {
  constructor(private readonly onUnauthorized: () => void) {
    super(NullLogger.instance);
  }

  override async send(request: HttpRequest): Promise<HttpResponse> {
    try {
      const response = await super.send(request);
      if (response.statusCode === 401) this.onUnauthorized();
      return response;
    } catch (error: unknown) {
      if (error instanceof HttpError && error.statusCode === 401) this.onUnauthorized();
      throw error;
    }
  }
}

export function connect(baseUrl: string, onChange: () => void): () => void {
  let disposed = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let tokenRejected = false;

  const connection: HubConnection = new HubConnectionBuilder()
    .withUrl(`${baseUrl}${REALTIME_HUB_PATH}`, {
      httpClient: new UnauthorizedAwareHttpClient(() => {
        tokenRejected = true;
      }),
      accessTokenFactory: async () => {
        const force = tokenRejected;
        tokenRejected = false;
        return freshAccessToken(force);
      },
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ({ previousRetryCount }) => retryDelayMs(previousRetryCount) })
    .configureLogging(LogLevel.None)
    .build();

  // Сервер шлёт `dataChanged` на любое изменение (задание, пользователь, категория, филиал,
  // уведомление, расписание); `assignmentChanged` дублирует задания только для старых вкладок.
  connection.on('dataChanged', onChange);
  connection.on('resync', onChange);
  // Пока соединения не было, события могли пройти мимо — догоняем одним перезапросом.
  connection.onreconnected(onChange);

  const start = (attempt: number, afterOutage: boolean): void => {
    if (disposed) return;
    connection
      .start()
      .then(() => {
        if (afterOutage) onChange();
      })
      .catch(() => {
        if (disposed) return;
        // Пока подключиться не удавалось, события могли пройти мимо — значит, после успеха догоняем.
        restartTimer = setTimeout(() => {
          start(attempt + 1, true);
        }, retryDelayMs(attempt));
      });
  };

  // Сюда попадаем, когда автоматическое переподключение невозможно (например, сервер
  // закрыл соединение по истечении токена) — тогда поднимаем его заново сами.
  connection.onclose(() => {
    if (!disposed) start(0, true);
  });

  start(0, false);

  return () => {
    disposed = true;
    clearTimeout(restartTimer);
    void connection.stop();
  };
}
