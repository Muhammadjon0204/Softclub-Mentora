import { apiClient } from '../../api/client';
import { resolveBranchHeaderValue } from './branchScopeStore';

export const BRANCH_HEADER_NAME = 'X-MTF-Branch-Id';

/**
 * Регистрирует свой собственный request-интерцептор на уже существующем
 * `apiClient` — по тому же приёму саморегистрации, что и `refreshCoordinator`
 * (`setRefreshRunner`). `client.ts` не редактируется вообще: axios поддерживает
 * несколько независимых интерцепторов на одном инстансе.
 *
 * Правило (ТЗ 2.2, раздел 38.3): заголовок добавляется ТОЛЬКО когда текущий
 * пользователь — Organization Admin и явно выбрал конкретный филиал. Branch
 * Admin, Lead и Mentor никогда не получают этот заголовок на своих запросах;
 * режим «Все филиалы» тоже не добавляет заголовок (это read-only агрегат).
 */
let registered = false;

export function registerBranchHeaderInterceptor(): void {
  if (registered) return;
  registered = true;

  apiClient.interceptors.request.use((config) => {
    // Users/Categories-домены (`api/admin/users.ts#createUser`, `api/admin/categories.ts`) иногда
    // должны адресовать запрос конкретному филиалу, отличному от того, что сейчас выбран в глобальном
    // селекторе (например, create-форма со своим выбором филиала, или смена роли/перевод пользователя
    // в другой филиал) — POST /users и POST /categories не принимают branchId в теле вообще, только
    // через этот заголовок (см. `UserService.BuildNewUserAsync`/`CategoryService.CreateAsync`).
    // Явно установленный вызывающим кодом заголовок имеет приоритет над глобальным состоянием.
    if (config.headers.has(BRANCH_HEADER_NAME)) return config;
    const branchId = resolveBranchHeaderValue();
    if (branchId !== null) config.headers.set(BRANCH_HEADER_NAME, branchId);
    return config;
  });
}
