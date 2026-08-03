/** Демо-данные страницы /admin/health (UI-прототип, раздел 13 сессии). */

export type PreviewServiceStatus = 'Operational' | 'Degraded' | 'Unavailable';

export const SERVICE_STATUS_LABEL: Record<PreviewServiceStatus, string> = {
  Operational: 'Работает',
  Degraded: 'Ограниченная доступность',
  Unavailable: 'Недоступен',
};

export interface PreviewService {
  id: string;
  name: string;
  status: PreviewServiceStatus;
  latencyMs: number;
  uptimePct: number;
  lastCheckedLabel: string;
  description: string;
}

export const PREVIEW_SERVICES: PreviewService[] = [
  { id: 'api', name: 'API', status: 'Operational', latencyMs: 82, uptimePct: 99.98, lastCheckedLabel: 'только что', description: 'Основной REST API приложения' },
  { id: 'db', name: 'PostgreSQL', status: 'Operational', latencyMs: 14, uptimePct: 99.99, lastCheckedLabel: '30 секунд назад', description: 'Основная база данных' },
  { id: 'minio', name: 'MinIO', status: 'Operational', latencyMs: 46, uptimePct: 99.9, lastCheckedLabel: '1 минуту назад', description: 'Хранилище файлов и вложений' },
  { id: 'email', name: 'Email', status: 'Degraded', latencyMs: 640, uptimePct: 98.7, lastCheckedLabel: '2 минуты назад', description: 'Повышенная задержка у внешнего SMTP-провайдера' },
  { id: 'telegram', name: 'Telegram', status: 'Operational', latencyMs: 210, uptimePct: 99.6, lastCheckedLabel: '2 минуты назад', description: 'Bot API для уведомлений' },
  { id: 'scheduler', name: 'Scheduler', status: 'Operational', latencyMs: 5, uptimePct: 99.95, lastCheckedLabel: '5 минут назад', description: 'Фоновые задачи и напоминания' },
];

export const PREVIEW_SYSTEM_EVENTS: { id: string; level: 'info' | 'warning' | 'error'; message: string; timeLabel: string }[] = [
  { id: 'evt-1', level: 'info', message: 'Резервное копирование базы данных завершено', timeLabel: '08:00' },
  { id: 'evt-2', level: 'info', message: 'Плановый запуск планировщика заданий завершён', timeLabel: '07:00' },
  { id: 'evt-3', level: 'warning', message: 'Повторная отправка email-уведомления (попытка 2 из 5)', timeLabel: '06:41' },
  { id: 'evt-4', level: 'warning', message: 'Повышенная задержка чтения из хранилища MinIO', timeLabel: '05:58' },
  { id: 'evt-5', level: 'info', message: 'Проверка доступности сервисов восстановлена в норму', timeLabel: '04:30' },
];

/** Compact availability за 24 часа — доля успешных проверок по часам, 0..100. */
export const PREVIEW_AVAILABILITY_24H: number[] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 96, 97, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];
