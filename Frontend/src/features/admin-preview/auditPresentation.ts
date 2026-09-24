import type { BadgeTone } from '../../shared/ui/Badge';

/** `Backend/src/MentorTaskFlow.Domain/Auditing/AuditActions.cs` — стабильные коды действий (TZ 10.14). */
const AUDIT_ACTION_LABEL: Record<string, string> = {
  'organization.update': 'Изменена организация',
  'branch.create': 'Филиал создан',
  'branch.update': 'Филиал изменён',
  'branch.activate': 'Филиал активирован',
  'branch.deactivate': 'Филиал деактивирован',
  'branch.make_head_office': 'Назначен головным офисом',
  'branch.timezone_change': 'Изменён часовой пояс филиала',
  'user.create': 'Пользователь добавлен',
  'user.create_organization_admin': 'Добавлен администратор организации',
  'user.update': 'Данные пользователя изменены',
  'user.activate': 'Пользователь активирован',
  'user.deactivate': 'Пользователь деактивирован',
  'user.change_role': 'Изменена роль пользователя',
  'user.change_admin_scope': 'Изменена область доступа администратора',
  'user.change_category': 'Пользователь переведён в другое направление',
  'user.change_branch': 'Пользователь переведён в другой филиал',
  'user.left_branch': 'Пользователь покинул филиал',
  'user.joined_branch': 'Пользователь добавлен в филиал',
  'category.create': 'Направление создано',
  'category.update': 'Направление изменено',
  'category.activate': 'Направление активировано',
  'category.deactivate': 'Направление деактивировано',
  'category.settings_update': 'Изменены настройки направления',
  'topic.create': 'Тема создана',
  'topic.update': 'Тема изменена',
  'topic.delete': 'Тема удалена',
  'topic_assignment.create': 'Назначение по теме создано',
  'topic_assignment.update': 'Назначение по теме изменено',
  'topic_assignment.delete': 'Назначение по теме удалено',
  'auth.login': 'Вход в систему',
  'auth.logout': 'Выход из системы',
  'auth.password_change': 'Смена пароля',
  'auth.password_reset': 'Сброс пароля',
  'auth.password_set': 'Установка пароля',
  'auth.refresh_reuse_detected': 'Обнаружено повторное использование токена',
  'security.scope_override_rejected': 'Отклонена попытка выйти за пределы доступа',
  'security.cross_scope_rejected': 'Отклонён доступ за пределами области',
  'assignment.force_cancel': 'Задание принудительно отменено',
  'scheduler.no_active_mentor': 'Нет активного ментора',
  'retention.cleanup': 'Автоматическая очистка данных',
  'notification.retry': 'Повторная отправка уведомления',
  'telegram.bind': 'Telegram подключён',
  'telegram.unbind': 'Telegram отключён',
  'storage.orphan_cleanup': 'Очистка неиспользуемых файлов',
  'storage.cross_scope_inconsistency': 'Несоответствие в хранилище файлов',
  'report.organization_export': 'Экспорт отчёта организации',
  'ai.summary_generate': 'Сгенерирована AI-сводка',
  'audit.read': 'Просмотр журнала аудита',
  'bootstrap.provision': 'Инициализация организации',
};

/** Тон точки/бейджа — по смыслу действия, не по конкретному коду (иначе список рос бы бесконечно). */
function toneForAction(action: string): BadgeTone {
  if (action.includes('reject') || action.includes('reuse_detected') || action.endsWith('.force_cancel')) return 'danger';
  if (action.endsWith('.delete') || action.endsWith('.deactivate') || action.endsWith('.unbind')) return 'danger';
  if (action.endsWith('.create') || action.endsWith('.activate') || action.endsWith('.bind') || action.endsWith('.password_set')) return 'success';
  if (action.includes('update') || action.includes('change_') || action.endsWith('.timezone_change') || action.endsWith('.make_head_office')) return 'info';
  return 'neutral';
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export function auditActionTone(action: string): BadgeTone {
  return toneForAction(action);
}

/** `AuditLogEntryDto.EntityType` — `nameof(Entity)` с бэкенда. */
const AUDIT_ENTITY_LABEL: Record<string, string> = {
  Organization: 'Организация',
  Branch: 'Филиал',
  User: 'Пользователь',
  Category: 'Направление',
  Topic: 'Тема',
  TopicAssignment: 'Назначение по теме',
  Assignment: 'Задание',
  AuditLog: 'Журнал аудита',
  NotificationOutbox: 'Уведомление',
};

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABEL[entityType] ?? entityType;
}

/** `AuditLogEntryDto.ActorType` — `AuditActorType` enum (`User` | `System`). */
const AUDIT_ACTOR_LABEL: Record<string, string> = {
  User: 'Пользователь',
  System: 'Система',
};

export function auditActorLabel(actorType: string): string {
  return AUDIT_ACTOR_LABEL[actorType] ?? actorType;
}
