import type { PreviewCategory, PreviewCategoryColor } from '../../mocks/ui-preview/categories.preview';

export { branchDisplayName, BRANCH_DIRECTORY } from '../admin-preview/branchDirectory';

export const CATEGORY_COLOR_TILE: Record<PreviewCategoryColor, string> = {
  indigo: 'bg-brand-soft text-brand',
  blue: 'bg-info-soft text-info',
  cyan: 'bg-[var(--secondary-cyan)]/15 text-[var(--secondary-cyan)]',
  violet: 'bg-[var(--secondary-violet)]/15 text-[var(--secondary-violet)]',
};

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Dushanbe', label: 'Asia/Dushanbe (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+6)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
] as const;
export const DEFAULT_TIMEZONE = 'Asia/Dushanbe';
export const DEFAULT_DUE_TIME = '23:59';
export const DEFAULT_DUE_DAYS = 3;

export type CategoryActivityKind = 'created' | 'updated' | 'lead_assigned' | 'lead_changed' | 'activated' | 'deactivated';

export interface CategoryActivityEntry {
  id: string;
  kind: CategoryActivityKind;
  label: string;
  detail?: string;
  actorName: string;
  relativeTime: string;
  absoluteLabel: string;
}

export interface PreviewCategoryDetails extends PreviewCategory {
  description: string | null;
  /** `null`, если `leadName` не находит соответствия среди пользователей с ролью Lead (несогласованность seed-данных этапа 1) — считаем это отсутствием реальной связи, а не ошибкой. */
  leadUserId: string | null;
  createdLabel: string;
  timezone: string;
  /** HH:mm — CAT-013, наследуется от Branch.TimeZoneId при создании (раздел 39.4 ТЗ). */
  defaultDueTimeLocal: string;
  defaultDueDays: number;
  allowLateSubmission: boolean;
  completedThisPeriod: number;
  activity: CategoryActivityEntry[];
  /** Реальный GUID филиала — для мутаций (`useCategoryActions.ts`). */
  branchId: string;
  /** `undefined` у preview-фикстур; строка у данных с backend. */
  concurrencyToken?: string;
  /**
   * `timezone`/`defaultDueTimeLocal`/`defaultDueDays`/`allowLateSubmission` выше приходят из
   * отдельного backend-ресурса (`GET /categories/{id}/settings`, свой `concurrencyToken`) и не
   * входят в список `GET /categories` — при построении списка это плейсхолдеры по умолчанию,
   * `true` только после того как `useCategorySettingsQuery()` реально их загрузил.
   */
  settingsLoaded?: boolean;
}

/** Детерминированный хэш id — используется для стабильного `colorToken` (`useCategoriesQuery.ts`), не связан с seed-данными preview. */
export function stableHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash;
}

export function emptyOrValue(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim().length === 0 ? 'Не назначено' : value;
}

export function healthTone(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 90) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
}
