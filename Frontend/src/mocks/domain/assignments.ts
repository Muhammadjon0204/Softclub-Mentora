import { db, type MockUser } from '../db';
import { CATEGORIES, ORGANIZATION, type MockCategory } from './organization';
import { DAY_MS, HOUR_MS, MOCK_NOW } from './reference';

export type AssignmentStatus =
  | 'Draft'
  | 'Suggested'
  | 'Assigned'
  | 'Submitted'
  | 'InReview'
  | 'NeedsRework'
  | 'Overdue'
  | 'Approved'
  | 'Cancelled';

export type AssignmentSource = 'Auto' | 'Manual';

export interface MockAssignment {
  id: string;
  organizationId: string;
  branchId: string;
  categoryId: string;
  topicTitle: string;
  assignedToId: string;
  assignedById: string | null;
  status: AssignmentStatus;
  source: AssignmentSource;
  isLate: boolean;
  initialDueAt: number;
  currentDueAt: number;
  createdAt: number;
  lastActivityAt: number;
  cancelReason: string | null;
}

const TITLE_POOL = [
  'Основы SOLID-принципов',
  'Работа с коллекциями и LINQ',
  'Асинхронное программирование',
  'Проектирование REST API',
  'Модульное тестирование',
  'Работа с базой данных через ORM',
  'Компонентная архитектура интерфейса',
  'Оптимизация производительности',
  'Валидация и обработка ошибок',
  'Аутентификация и авторизация',
  'Паттерны проектирования',
  'Code review и рефакторинг',
] as const;

const ACTIVE_LEAD_CYCLE: AssignmentStatus[] = [
  'Approved',
  'Assigned',
  'Submitted',
  'Suggested',
  'Approved',
  'InReview',
  'NeedsRework',
  'Overdue',
  'Approved',
  'Assigned',
  'Draft',
  'Submitted',
  'Approved',
  'Cancelled',
];

const HISTORICAL_CYCLE: AssignmentStatus[] = ['Approved', 'Approved', 'Cancelled', 'Approved'];

const SOURCE_CYCLE: AssignmentSource[] = ['Auto', 'Auto', 'Manual', 'Auto'];

const CANCEL_REASONS = [
  'Курс изменил порядок тем — задание больше не актуально',
  'Ментор переведён на другую тему',
  'Дублирующее задание, создано повторно по ошибке',
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function usersOf(categoryId: string, role: 'Mentor' | 'Lead'): MockUser[] {
  return db.users.filter(
    (user) => user.categoryId === categoryId && user.role === role && user.isActive,
  );
}

function buildForCategory(category: MockCategory): MockAssignment[] {
  const mentors = usersOf(category.id, 'Mentor');
  if (mentors.length === 0) return [];

  const leads = usersOf(category.id, 'Lead');
  const leadId = leads[0]?.id ?? null;
  const categorySalt = hashString(category.id);

  const isHistoricalOnly = !category.isActive;
  const isSuggestedOnly = category.isActive && leadId === null;

  const count = isHistoricalOnly
    ? 5
    : isSuggestedOnly
      ? Math.min(mentors.length * 2, 10)
      : Math.min(mentors.length * 3, 24);

  const result: MockAssignment[] = [];

  for (let index = 0; index < count; index += 1) {
    const cycle = isHistoricalOnly ? HISTORICAL_CYCLE : ACTIVE_LEAD_CYCLE;
    let status: AssignmentStatus = isSuggestedOnly
      ? 'Suggested'
      : cycle[(index + categorySalt) % cycle.length];

    const source = SOURCE_CYCLE[(index + categorySalt) % SOURCE_CYCLE.length];
    const ageDays = ((index * 3 + categorySalt) % 35) + 1;
    const createdAt = MOCK_NOW - ageDays * DAY_MS;
    const initialDueAt = createdAt + category.defaultAssignmentDueDays * DAY_MS;
    let currentDueAt = initialDueAt;

    const isPastDue = currentDueAt < MOCK_NOW;
    if (status === 'Assigned' && isPastDue) status = 'Overdue';
    if (status === 'NeedsRework') currentDueAt = MOCK_NOW + 2 * DAY_MS;

    const mentor = mentors[(index + categorySalt) % mentors.length];
    const isDraftOrSuggested = status === 'Draft' || status === 'Suggested';

    let lastActivityAt: number;
    if (status === 'Approved') lastActivityAt = Math.max(createdAt, initialDueAt - 2 * DAY_MS);
    else if (status === 'Cancelled') lastActivityAt = createdAt + DAY_MS;
    else if (status === 'Overdue') lastActivityAt = currentDueAt;
    else if (isDraftOrSuggested) lastActivityAt = createdAt;
    else lastActivityAt = MOCK_NOW - (((index + categorySalt) % 6) + 1) * HOUR_MS;
    lastActivityAt = Math.min(Math.max(lastActivityAt, createdAt), MOCK_NOW);

    const isLate =
      status === 'Overdue' ||
      (!isDraftOrSuggested && status !== 'Cancelled' && (index + categorySalt) % 9 === 0);

    result.push({
      id: `asn-${category.id}-${String(index + 1).padStart(3, '0')}`,
      organizationId: ORGANIZATION.id,
      branchId: category.branchId,
      categoryId: category.id,
      topicTitle: TITLE_POOL[(index + categorySalt) % TITLE_POOL.length],
      assignedToId: mentor.id,
      assignedById: isDraftOrSuggested ? null : leadId,
      status,
      source: isDraftOrSuggested ? 'Manual' : source,
      isLate,
      initialDueAt,
      currentDueAt,
      createdAt,
      lastActivityAt,
      cancelReason:
        status === 'Cancelled' ? CANCEL_REASONS[(index + categorySalt) % CANCEL_REASONS.length] : null,
    });
  }

  return result;
}

let cache: MockAssignment[] | null = null;

/** Ленивая построение: требует, чтобы `db.users` уже был заполнен сидом. */
export function allAssignments(): MockAssignment[] {
  cache ??= CATEGORIES.flatMap((category) => buildForCategory(category));
  return cache;
}

/** Только для тестов — пересобрать после `resetDb()`. */
export function invalidateAssignmentsCache(): void {
  cache = null;
}
