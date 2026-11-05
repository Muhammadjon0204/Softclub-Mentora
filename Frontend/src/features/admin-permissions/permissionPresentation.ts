import type { PermissionSubject } from '../../api/admin/permissions';

export const SUBJECT_LABEL: Record<PermissionSubject, string> = {
  BranchAdmin: 'Админ филиала',
  Lead: 'Тимлид',
  Mentor: 'Ментор',
};

export const SUBJECTS: PermissionSubject[] = ['BranchAdmin', 'Lead', 'Mentor'];

/** Названия простым языком: администратор читает это как «что человек может», а не как код. */
export const PERMISSION_INFO: Record<string, { label: string; hint: string }> = {
  'assignments.assign': { label: 'Выдавать задания', hint: 'Создавать задания и публиковать их' },
  'assignments.reassign': { label: 'Переназначать задания', hint: 'Передавать своё задание другому исполнителю' },
  'assignments.reschedule': { label: 'Менять сроки', hint: 'Переносить срок своего задания с указанием причины' },
  'assignments.cancel': { label: 'Отменять задания', hint: 'Останавливать работу с указанием причины' },
  'assignments.review': { label: 'Проверять работы', hint: 'Принимать работы и возвращать их на доработку' },
  'schedule.manage': { label: 'Вести расписание', hint: 'Темы и шаблоны заданий направления' },
  'proposals.create': { label: 'Подавать предложения', hint: 'Мастер-классы, дополнительные уроки и другие идеи' },
  'proposals.decide': { label: 'Решать по предложениям', hint: 'Принимать идеи менторов и отклонять их' },
  'users.manage': { label: 'Управлять пользователями', hint: 'Приглашать людей и менять их данные' },
  'categories.manage': { label: 'Управлять направлениями', hint: 'Создавать направления и менять их настройки' },
  'permissions.manage': { label: 'Настраивать права', hint: 'Ограничивать людей своего филиала' },
  'reports.view': { label: 'Смотреть отчёты', hint: 'Личные и командные отчёты, AI-резюме' },
  'audit.view': { label: 'Смотреть журнал аудита', hint: 'Действия пользователей в системе' },
  'crm.use': { label: 'Работать с CRM', hint: 'Группы из CRM и отчёты по ним' },
};

export const PERMISSION_GROUP_LABEL: Record<string, string> = {
  assignments: 'Задания',
  proposals: 'Предложения',
  team: 'Команда',
  data: 'Данные и отчёты',
};

export function permissionLabel(key: string): string {
  return PERMISSION_INFO[key]?.label ?? key;
}
