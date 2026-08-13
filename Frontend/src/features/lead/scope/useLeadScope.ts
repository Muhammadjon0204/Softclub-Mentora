import { useAuth } from '../../../auth/useAuth';
import { categoryDirectoryEntry } from './leadWorkspace';

export interface LeadScope {
  leadId: string;
  leadName: string;
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
 * Единственная точка входа в собственный scope Lead (ТЗ 2.2, раздел 8.3 —
 * ровно одна Category одного Branch). Значения берутся из `AuthUser`
 * (`GET /auth/me` / login response), а не из URL или локального состояния —
 * то же правило, что `BranchContext` формулирует для Branch (`FE-034`):
 * это UX-удобство, не граница безопасности, но оно обязано быть единственным
 * источником для всех Lead-страниц, чтобы ни одна из них не читала scope
 * по-своему (раздел 5 задачи Phase 3).
 *
 * Рендерится только внутри `RequireRole(['Lead'])`, поэтому `user` здесь
 * всегда `Lead` с обязательными `branch` и `categoryId` (CHECK ТЗ 12.2).
 * Отсутствие директории для `categoryId` — дефект конфигурации preview-справочника,
 * а не легитимное состояние, поэтому это исключение, а не тихий fallback.
 */
export function useLeadScope(): LeadScope {
  const { user } = useAuth();

  if (user === null || user.role !== 'Lead' || user.branch === null || user.categoryId === null) {
    throw new Error('useLeadScope: доступен только аутентифицированному Lead с назначенной категорией');
  }

  const category = categoryDirectoryEntry(user.categoryId);
  if (category === undefined) {
    throw new Error(`useLeadScope: категория ${user.categoryId} отсутствует в preview-справочнике`);
  }

  return {
    leadId: user.id,
    leadName: user.fullName,
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
