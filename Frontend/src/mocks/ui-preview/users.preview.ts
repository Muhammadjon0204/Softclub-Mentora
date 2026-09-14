/** Общие label-словари страницы /admin/users. */

export type PreviewUserRole = 'OrgAdmin' | 'BranchAdmin' | 'Lead' | 'Mentor';
export type PreviewUserStatus = 'Active' | 'Invited' | 'Locked' | 'Deactivated';

export interface PreviewUser {
  id: string;
  fullName: string;
  email: string;
  role: PreviewUserRole;
  branchName: string;
  categoryName: string | null;
  status: PreviewUserStatus;
  lastLoginLabel: string;
  createdLabel: string;
}

export const ROLE_LABEL: Record<PreviewUserRole, string> = {
  OrgAdmin: 'Администратор организации',
  BranchAdmin: 'Администратор филиала',
  Lead: 'Руководитель направления',
  Mentor: 'Ментор',
};

export const STATUS_LABEL: Record<PreviewUserStatus, string> = {
  Active: 'Активен',
  Invited: 'Приглашён',
  Locked: 'Заблокирован',
  Deactivated: 'Деактивирован',
};

/*
 * Раньше этот файл продолжался фиксированным набором из 36 пользователей (`FEATURED_USERS` +
 * `buildMentors(26)`, правдоподобные email вида `имя.фамилия@softclub-academy.test`) — тот самый
 * seed, что утёк в прод-бандл через `PREVIEW_NEW_USERS_SERIES` (`pages/admin/UsersPage.tsx`,
 * исправлено коммитом 78bb942). Все реальные страницы теперь читают исключительно `GET /users`
 * (`features/admin-users/useUsersQuery.ts`) — фиктивные данные удалены целиком, а не просто
 * отвязаны от импорта, чтобы этот класс бага (случайный value-импорт утягивает весь фикстур
 * обратно в прод-чанк) не мог повториться.
 */
