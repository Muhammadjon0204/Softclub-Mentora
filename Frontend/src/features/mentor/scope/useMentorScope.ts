import { useAuth } from '../../../auth/useAuth';
import { categoryDirectoryEntry } from './mentorWorkspace';

export interface MentorScope {
  mentorId: string;
  mentorName: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchRawName: string;
  branchDisplayName: string;
  categoryId: string;
  categoryName: string;
  timeZoneId: string;
}

/**
 * Единственная точка входа в собственный scope Mentor — прямой аналог
 * `useLeadScope()` (см. `features/lead/scope/useLeadScope.ts`), но для роли
 * Mentor. Значения берутся из `AuthUser` (`GET /auth/me` / login response),
 * а не из URL/локального состояния, чтобы ни одна Mentor-страница не читала
 * scope по-своему.
 *
 * Рендерится только внутри `RequireRole(['Mentor'])`, поэтому `user` здесь
 * всегда `Mentor` с обязательными `branch` и `categoryId`.
 */
export function useMentorScope(): MentorScope {
  const { user } = useAuth();

  if (user === null || user.role !== 'Mentor' || user.branch === null || user.categoryId === null) {
    throw new Error('useMentorScope: доступен только аутентифицированному Mentor с назначенной категорией');
  }

  const category = categoryDirectoryEntry(user.categoryId);
  if (category === undefined) {
    throw new Error(`useMentorScope: категория ${user.categoryId} отсутствует в preview-справочнике`);
  }

  return {
    mentorId: user.id,
    mentorName: user.fullName,
    organizationId: user.organization.id,
    organizationName: user.organization.name,
    branchId: user.branch.id,
    branchRawName: user.branch.name,
    branchDisplayName: category.branchDisplayName,
    categoryId: category.id,
    categoryName: category.name,
    timeZoneId: category.timeZoneId,
  };
}
