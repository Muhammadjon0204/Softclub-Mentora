/** Демо-данные страницы /admin/audit (UI-прототип, раздел 11 сессии). */

export type PreviewAuditResult = 'Success' | 'Rejected' | 'Error';

export const AUDIT_RESULT_LABEL: Record<PreviewAuditResult, string> = {
  Success: 'Успешно',
  Rejected: 'Отклонено',
  Error: 'Ошибка',
};

export interface PreviewAuditEntry {
  id: string;
  timeLabel: string;
  actorName: string;
  actorRole: string;
  branchName: string | null;
  action: string;
  entityLabel: string;
  result: PreviewAuditResult;
  correlationId: string;
  metadata: { key: string; value: string }[];
}

export const PREVIEW_AUDIT_ENTRIES: PreviewAuditEntry[] = [
  {
    id: 'audit-1',
    timeLabel: 'Сегодня, 10:24',
    actorName: 'Фируз Алимов',
    actorRole: 'Администратор организации',
    branchName: 'Филиал Худжанд',
    action: 'Создан пользователь',
    entityLabel: 'Далер Сафаров (Lead)',
    result: 'Success',
    correlationId: 'c7a1e2f0-91b4-4d3a-8f2c-1a2b3c4d5e6f',
    metadata: [
      { key: 'Роль', value: 'Руководитель направления' },
      { key: 'Категория', value: 'Python' },
      { key: 'Приглашение отправлено', value: 'Да' },
    ],
  },
  {
    id: 'audit-2',
    timeLabel: 'Сегодня, 09:58',
    actorName: 'Мадина Юсупова',
    actorRole: 'Администратор филиала',
    branchName: 'Филиал Худжанд',
    action: 'Изменена категория пользователя',
    entityLabel: 'Нигина Джалолова',
    result: 'Success',
    correlationId: 'b3f4a5c6-1234-4abc-9def-0123456789ab',
    metadata: [
      { key: 'Было', value: 'Mobile Development' },
      { key: 'Стало', value: 'QA' },
    ],
  },
  {
    id: 'audit-3',
    timeLabel: 'Вчера, 17:32',
    actorName: 'Феруза Каримова',
    actorRole: 'Администратор филиала',
    branchName: 'Филиал Бохтар',
    action: 'Деактивирован филиал',
    entityLabel: 'Тестовый филиал (черновик)',
    result: 'Success',
    correlationId: 'a1b2c3d4-5678-4e9f-a0b1-c2d3e4f5a6b7',
    metadata: [{ key: 'Причина', value: 'Дубликат при настройке' }],
  },
  {
    id: 'audit-4',
    timeLabel: 'Вчера, 16:45',
    actorName: 'Система',
    actorRole: 'Scheduler',
    branchName: null,
    action: 'Планировщик: нет активных менторов',
    entityLabel: 'UI/UX Design · Филиал Бохтар',
    result: 'Error',
    correlationId: 'd4e5f6a7-89ab-4cde-8f01-234567890abc',
    metadata: [{ key: 'Затронуто заданий', value: '3' }],
  },
  {
    id: 'audit-5',
    timeLabel: 'Вчера, 14:12',
    actorName: 'Насим Раджабов',
    actorRole: 'Администратор филиала',
    branchName: 'Главный офис',
    action: 'Изменена роль',
    entityLabel: 'Умедчода Парвиз',
    result: 'Success',
    correlationId: 'e5f6a7b8-9012-4345-b678-90abcdef1234',
    metadata: [
      { key: 'Было', value: 'Ментор' },
      { key: 'Стало', value: 'Руководитель направления' },
    ],
  },
  {
    id: 'audit-6',
    timeLabel: 'Вчера, 11:03',
    actorName: 'Неизвестный actor',
    actorRole: '—',
    branchName: 'Филиал Худжанд',
    action: 'Отклонена попытка подмены scope',
    entityLabel: 'Заголовок X-MTF-Branch-Id',
    result: 'Rejected',
    correlationId: 'f6a7b8c9-0123-4456-c789-0abcdef12345',
    metadata: [{ key: 'IP', value: '192.168.14.22' }],
  },
  {
    id: 'audit-7',
    timeLabel: '2 дня назад, 09:15',
    actorName: 'Фируз Алимов',
    actorRole: 'Администратор организации',
    branchName: null,
    action: 'Изменены настройки',
    entityLabel: 'Профиль организации',
    result: 'Success',
    correlationId: 'a7b8c9d0-1234-4567-d890-1abcdef23456',
    metadata: [{ key: 'Изменено полей', value: '2' }],
  },
  {
    id: 'audit-8',
    timeLabel: '2 дня назад, 08:40',
    actorName: 'Сухроб Холов',
    actorRole: 'Руководитель направления',
    branchName: 'Главный офис',
    action: 'Выполнен вход',
    entityLabel: '—',
    result: 'Success',
    correlationId: 'b8c9d0e1-2345-4678-e901-2abcdef34567',
    metadata: [{ key: 'Устройство', value: 'Chrome · Windows' }],
  },
];

export const PREVIEW_AUDIT_SUMMARY = {
  today: 12,
  success: 9,
  rejected: 2,
  system: 1,
};
