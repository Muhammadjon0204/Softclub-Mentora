import { useCallback } from 'react';

import { useAuth } from './useAuth';

/** Каталог разрешений: `Backend/src/MentorTaskFlow.Domain/Access/Permissions.cs`. */
export const PERMISSION = {
  assignmentsAssign: 'assignments.assign',
  assignmentsReassign: 'assignments.reassign',
  assignmentsReschedule: 'assignments.reschedule',
  assignmentsCancel: 'assignments.cancel',
  assignmentsReview: 'assignments.review',
  proposalsCreate: 'proposals.create',
  proposalsDecide: 'proposals.decide',
  scheduleManage: 'schedule.manage',
  usersManage: 'users.manage',
  categoriesManage: 'categories.manage',
  reportsView: 'reports.view',
  auditView: 'audit.view',
  crmUse: 'crm.use',
  permissionsManage: 'permissions.manage',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

/**
 * Скрывает то, что всё равно закончилось бы отказом. Это удобство, а не граница безопасности:
 * решает сервер (`RequirePermissionAttribute`). Профиль без списка считается полным доступом
 * роли: так выглядит ответ старого сервера и моков, и прятать из-за этого меню было бы хуже.
 */
export function usePermissions(): { can: (permission: Permission) => boolean } {
  const { user } = useAuth();
  const granted = user?.permissions;

  const can = useCallback(
    (permission: Permission): boolean => granted === undefined || granted.includes(permission),
    [granted],
  );

  return { can };
}
