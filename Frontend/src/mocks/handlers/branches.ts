import { http } from 'msw';

import { BRANCHES } from '../domain/organization';
import { adminProblem, authenticateAdmin, correlationIdOf, jsonOk } from './shared';

const route = (path: string): string => `*/api/v1/${path}`;

export interface BranchListItemDto {
  id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
  isActive: boolean;
}

/**
 * GET /api/v1/branches — только Organization Admin (ТЗ BRN-006). Branch Admin
 * получает 403: список филиалов раскрывает состав организации за пределами
 * его собственного филиала (раздел 38, TEN-003).
 */
export const branchesHandlers = [
  http.get(route('branches'), ({ request }) => {
    const instance = '/api/v1/branches';
    const auth = authenticateAdmin(request, instance);
    if (!auth.ok) return auth.response;

    const correlationId = correlationIdOf(request);

    if (auth.scope.user.adminScope !== 'Organization') {
      return adminProblem({
        code: 'FORBIDDEN',
        detail: 'Список филиалов доступен только Organization Admin',
        instance,
        correlationId,
      });
    }

    const items: BranchListItemDto[] = BRANCHES.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isHeadOffice: branch.isHeadOffice,
      isActive: branch.isActive,
    }));

    return jsonOk({ items }, correlationId);
  }),
];
