import type { PreviewCategory, PreviewCategoryColor } from '../../mocks/ui-preview/categories.preview';
import type { PreviewUserDetails } from '../admin-users/userPresentation';

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
}

function stableHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash;
}

const SEED_CREATED_LABEL: Record<string, string> = {
  'cat-csharp': '11.01.2023',
  'cat-frontend': '11.01.2023',
  'cat-python': '02.02.2023',
  'cat-uiux': '21.06.2023',
  'cat-mobile': '18.04.2023',
  'cat-qa': '05.05.2023',
  'cat-devops': '30.07.2023',
  'cat-data': '05.05.2023',
};

const SEED_DESCRIPTION: Record<string, string> = {
  'cat-csharp': 'Backend-разработка на .NET/C# для сервисов организации.',
  'cat-frontend': 'Клиентские интерфейсы на React и TypeScript.',
  'cat-python': 'Python-разработка и автоматизация.',
  'cat-uiux': 'Проектирование интерфейсов и пользовательский опыт.',
  'cat-mobile': 'Мобильная разработка для iOS и Android.',
  'cat-qa': 'Тестирование и контроль качества.',
  'cat-devops': 'Инфраструктура, CI/CD и эксплуатация.',
  'cat-data': 'Анализ данных и модели машинного обучения.',
};

function findLeadUserId(category: PreviewCategory, users: PreviewUserDetails[]): string | null {
  if (category.leadName === null) return null;
  const match = users.find((user) => user.role === 'Lead' && user.fullName === category.leadName && user.branchName === category.branchName);
  return match?.id ?? null;
}

/** Достраивает preview-категорию полями настроек/активности, не трогая `categories.preview.ts`. */
export function enrichCategory(category: PreviewCategory, users: PreviewUserDetails[]): PreviewCategoryDetails {
  const hash = stableHash(category.id);
  const createdLabel = SEED_CREATED_LABEL[category.id] ?? '—';
  const leadUserId = findLeadUserId(category, users);

  const activity: CategoryActivityEntry[] = [
    { id: `${category.id}-ev-created`, kind: 'created', label: 'Направление создано', actorName: 'Администратор', relativeTime: createdLabel, absoluteLabel: createdLabel },
  ];
  if (category.leadName !== null) {
    activity.unshift({
      id: `${category.id}-ev-lead`,
      kind: 'lead_assigned',
      label: 'Назначен руководитель направления',
      detail: category.leadName,
      actorName: 'Администратор',
      relativeTime: createdLabel,
      absoluteLabel: createdLabel,
    });
  }

  return {
    ...category,
    description: SEED_DESCRIPTION[category.id] ?? null,
    leadUserId,
    createdLabel,
    timezone: DEFAULT_TIMEZONE,
    defaultDueTimeLocal: DEFAULT_DUE_TIME,
    defaultDueDays: DEFAULT_DUE_DAYS,
    allowLateSubmission: true,
    completedThisPeriod: 4 + (hash % 9),
    activity: activity.reverse(),
  };
}

export function emptyOrValue(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim().length === 0 ? 'Не назначено' : value;
}

export function healthTone(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 90) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
}
