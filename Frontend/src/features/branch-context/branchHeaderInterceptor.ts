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
    const branchId = resolveBranchHeaderValue();
    if (branchId !== null) config.headers.set(BRANCH_HEADER_NAME, branchId);
    return config;
  });
}
