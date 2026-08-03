/**
 * Module-singleton зеркало текущего branch scope — по образцу `auth/tokenStore.ts`.
 *
 * Зачем отдельно от React-состояния `BranchContext`: axios-интерцептор
 * (`branchHeaderInterceptor.ts`) не может вызвать `useContext` — он синхронная
 * функция вне дерева компонентов. `BranchProvider` синхронизирует сюда своё
 * состояние через `useEffect`, интерцептор читает его на каждый запрос.
 *
 * Это НЕ источник авторизации (ТЗ 2.2, TEN-036a): backend всё равно проверяет
 * scope самостоятельно. Здесь только то, что нужно решить — отправлять ли
 * заголовок `X-MTF-Branch-Id` и что показать в UI.
 */

interface BranchScopeState {
  /** `null` — режим «Все филиалы» либо пользователь без права его выбирать. */
  selectedBranchId: string | null;
  /** `true` только для Organization Admin — только он может слать заголовок. */
  canOverrideBranch: boolean;
}

type Listener = (state: BranchScopeState) => void;

let state: BranchScopeState = { selectedBranchId: null, canOverrideBranch: false };
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of [...listeners]) listener(state);
}

export function getBranchScopeState(): BranchScopeState {
  return state;
}

export function setBranchScopeState(next: BranchScopeState): void {
  state = next;
  notify();
}

export function resetBranchScopeState(): void {
  setBranchScopeState({ selectedBranchId: null, canOverrideBranch: false });
}

export function subscribeBranchScope(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Значение заголовка `X-MTF-Branch-Id`, если его вообще нужно отправлять. */
export function resolveBranchHeaderValue(): string | null {
  if (!state.canOverrideBranch) return null;
  return state.selectedBranchId;
}
