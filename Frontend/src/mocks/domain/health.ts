import { MOCK_NOW, MINUTE_MS } from './reference';

export type ServiceStatus = 'Operational' | 'Degraded' | 'Unavailable';

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  lastCheckedAt: number;
  message: string;
}

export interface SystemEvent {
  id: string;
  at: number;
  level: 'info' | 'warning' | 'error';
  message: string;
}

/** Статичный, но реалистичный снимок: один сервис в лёгкой деградации. */
export function getServiceHealth(): ServiceHealth[] {
  return [
    {
      id: 'api',
      name: 'API',
      status: 'Operational',
      latencyMs: 42,
      lastCheckedAt: MOCK_NOW,
      message: 'Отвечает штатно',
    },
    {
      id: 'postgres',
      name: 'PostgreSQL',
      status: 'Operational',
      latencyMs: 12,
      lastCheckedAt: MOCK_NOW,
      message: 'Пул соединений в норме',
    },
    {
      id: 'minio',
      name: 'MinIO',
      status: 'Operational',
      latencyMs: 28,
      lastCheckedAt: MOCK_NOW,
      message: 'Объектное хранилище доступно',
    },
    {
      id: 'email',
      name: 'Email',
      status: 'Degraded',
      latencyMs: 640,
      lastCheckedAt: MOCK_NOW - 4 * MINUTE_MS,
      message: 'Повышенная задержка у SMTP-провайдера; уведомления копятся в очереди',
    },
    {
      id: 'telegram',
      name: 'Telegram',
      status: 'Operational',
      latencyMs: 96,
      lastCheckedAt: MOCK_NOW,
      message: 'Webhook принимает обновления',
    },
    {
      id: 'scheduler',
      name: 'Планировщик',
      status: 'Operational',
      latencyMs: 15,
      lastCheckedAt: MOCK_NOW,
      message: 'Последний прогон завершён без ошибок',
    },
  ];
}

export function getRecentSystemEvents(): SystemEvent[] {
  return [
    {
      id: 'evt-1',
      at: MOCK_NOW - 4 * MINUTE_MS,
      level: 'warning',
      message: 'Email: рост латентности выше 500 мс — включён мониторинг',
    },
    {
      id: 'evt-2',
      at: MOCK_NOW - 55 * MINUTE_MS,
      level: 'info',
      message: 'Плановое обслуживание Outbox worker завершено',
    },
    {
      id: 'evt-3',
      at: MOCK_NOW - 3 * 60 * MINUTE_MS,
      level: 'error',
      message: 'DeadLetter: накоплено 3 уведомления за последний час',
    },
    {
      id: 'evt-4',
      at: MOCK_NOW - 6 * 60 * MINUTE_MS,
      level: 'info',
      message: 'Авто-генерация заданий выполнена по расписанию (06:00 Asia/Dushanbe)',
    },
  ];
}
