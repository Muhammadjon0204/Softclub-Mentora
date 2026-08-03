import type { AdminScope, UserRole } from '../api/auth';
import type { MockUser, SecurityToken } from './db';
import {
  BRANCH_BOKHTAR,
  BRANCH_HEAD_OFFICE,
  BRANCH_KHUJAND,
  ORGANIZATION,
} from './domain/organization';

/**
 * Исходные данные mock-«сервера»: аккаунты и security-токены под конкретные
 * QA-сценарии. Модуль намеренно не импортирует `db` в рантайме — только типы,
 * поэтому цикла `db -> scenarios -> db` не возникает.
 *
 * Все значения предназначены исключительно для development-QA. Ничего здесь
 * не генерируется через `Math.random()` — состав пользователей и их поля
 * фиксированы посимвольно, чтобы тесты и ручное QA были воспроизводимы.
 */

export const DEMO_PASSWORD = 'DemoPassword1!';

const CATEGORY_HQ_CSHARP = 'cat-hq-csharp';
const CATEGORY_HQ_PYTHON = 'cat-hq-python';
const CATEGORY_HQ_FRONTEND = 'cat-hq-frontend';
const CATEGORY_KHU_CSHARP = 'cat-khu-csharp';
const CATEGORY_KHU_PYTHON = 'cat-khu-python';
const CATEGORY_KHU_DESIGN = 'cat-khu-design';
const CATEGORY_BOK_CSHARP = 'cat-bok-csharp';
const CATEGORY_BOK_FRONTEND = 'cat-bok-frontend';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Живут долго, чтобы QA-ссылки не протухали за время сессии разработки. */
const SEEDED_VALID_TTL = 30 * DAY;

export interface DbSeed {
  users: MockUser[];
  securityTokens: SecurityToken[];
}

interface UserSeed {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  adminScope?: AdminScope;
  branchId: string | null;
  categoryId: string | null;
  passwordHash: string | null;
  isActive?: boolean;
  failedLoginCount?: number;
  lockoutUntil?: number | null;
  createdOffsetDays: number;
  lastLoginOffsetHours?: number | null;
}

/** Пул имён для ростера — только для заполнения списков количеством, не для входа. */
const ROSTER_NAME_POOL = [
  'Олим Назаров',
  'Дилноза Каримова',
  'Хуршед Латипов',
  'Зарина Юсупова',
  'Бахтиёр Одинаев',
  'Мунира Саидова',
  'Джамшед Холов',
  'Наргис Файзуллоева',
  'Сухроб Эргашев',
  'Парвина Мухаммадиева',
  'Искандар Валиев',
  'Фотима Расулова',
  'Немат Курбонов',
  'Шабнам Ахмедова',
  'Аброр Тошматов',
  'Малика Сафарова',
  'Ориф Джалилов',
  'Севара Ниязова',
  'Ботир Умаров',
  'Гулбахор Раджабова',
] as const;

function rosterMentors(
  branchId: string,
  categoryId: string,
  count: number,
  offset: number,
  createdOffsetDays: number,
): UserSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const poolIndex = (offset + index) % ROSTER_NAME_POOL.length;
    const name = ROSTER_NAME_POOL[poolIndex];
    const slug = `${categoryId}-${String(index + 1)}`;
    return {
      id: `usr-ros-${slug}`,
      fullName: name,
      email: `roster.${slug}@softclub-academy.test`,
      role: 'Mentor' as const,
      branchId,
      categoryId,
      passwordHash: DEMO_PASSWORD,
      // Каждый пятый — приглашён, но ещё не установил пароль: реалистичная картина.
      isActive: true,
      createdOffsetDays: createdOffsetDays + index,
      lastLoginOffsetHours: index % 5 === 4 ? null : (index + 1) * 6,
    };
  }).map((seed, index) =>
    index % 5 === 4 ? { ...seed, passwordHash: null, lastLoginOffsetHours: null } : seed,
  );
}

function buildUsers(now: number): MockUser[] {
  const seeds: UserSeed[] = [
    /* ---------------------------- Organization Admin ---------------------------- */
    {
      id: 'usr-1001',
      fullName: 'Азиза Раимова',
      email: 'admin@mentortaskflow.test',
      role: 'Admin',
      adminScope: 'Organization',
      branchId: null,
      categoryId: null,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 420,
      lastLoginOffsetHours: 1,
    },
    {
      id: 'usr-1010',
      fullName: 'Шахло Мирзоева',
      email: 'organization-admin@mentortaskflow.test',
      role: 'Admin',
      adminScope: 'Organization',
      branchId: null,
      categoryId: null,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 400,
      lastLoginOffsetHours: 26,
    },

    /* ------------------------------- Branch Admin -------------------------------- */
    {
      id: 'usr-1011',
      fullName: 'Парвиз Исмоилов',
      email: 'branch-admin-head@mentortaskflow.test',
      role: 'Admin',
      adminScope: 'Branch',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: null,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 390,
      lastLoginOffsetHours: 3,
    },
    {
      id: 'usr-1012',
      fullName: 'Гулнора Абдуллаева',
      email: 'branch-admin-khujand@mentortaskflow.test',
      role: 'Admin',
      adminScope: 'Branch',
      branchId: BRANCH_KHUJAND,
      categoryId: null,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 300,
      lastLoginOffsetHours: 20,
    },
    // Филиал Бохтар намеренно БЕЗ Branch Admin — валидный, но наблюдаемый
    // случай (ТЗ 2.2, TEN-017 / уведомление BranchWithoutAdmin).

    /* ------------------------------------ Lead ----------------------------------- */
    {
      id: 'usr-1002',
      fullName: 'Далер Сафаров',
      email: 'lead@mentortaskflow.test',
      role: 'Lead',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_PYTHON,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 380,
      lastLoginOffsetHours: 2,
    },
    {
      id: 'usr-1006',
      fullName: 'Фаррух Хакимов',
      email: 'reuse@mentortaskflow.test',
      role: 'Lead',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_FRONTEND,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 200,
      lastLoginOffsetHours: 48,
    },
    {
      id: 'usr-1013',
      fullName: 'Шерали Комилов',
      email: 'lead-head@mentortaskflow.test',
      role: 'Lead',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_CSHARP,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 370,
      lastLoginOffsetHours: 4,
    },
    {
      id: 'usr-1014',
      fullName: 'Тимур Расулов',
      email: 'lead-khujand@mentortaskflow.test',
      role: 'Lead',
      branchId: BRANCH_KHUJAND,
      categoryId: CATEGORY_KHU_CSHARP,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 260,
      lastLoginOffsetHours: 5,
    },
    {
      id: 'usr-1015',
      fullName: 'Олим Назаров',
      email: 'lead.python@softclub-academy.test',
      role: 'Lead',
      branchId: BRANCH_KHUJAND,
      categoryId: CATEGORY_KHU_PYTHON,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 250,
      lastLoginOffsetHours: 30,
    },
    {
      id: 'usr-1016',
      fullName: 'Дилноза Каримова',
      email: 'lead.bokhtar@softclub-academy.test',
      role: 'Lead',
      branchId: BRANCH_BOKHTAR,
      categoryId: CATEGORY_BOK_CSHARP,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 180,
      lastLoginOffsetHours: 72,
    },
    // cat-khu-design намеренно без активного Lead — категория остаётся рабочей,
    // Suggested копятся (ТЗ SCH-018), Admin видит уведомление CategoryWithoutLead.

    /* ----------------------------------- Mentor ----------------------------------- */
    {
      id: 'usr-1003',
      fullName: 'Нилуфар Каримова',
      email: 'mentor@mentortaskflow.test',
      role: 'Mentor',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_FRONTEND,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 150,
      lastLoginOffsetHours: 6,
    },
    {
      id: 'usr-1004',
      fullName: 'Рустам Ниёзов',
      email: 'locked@mentortaskflow.test',
      role: 'Mentor',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_CSHARP,
      passwordHash: DEMO_PASSWORD,
      failedLoginCount: 5,
      lockoutUntil: now + 15 * MINUTE,
      createdOffsetDays: 140,
      lastLoginOffsetHours: 200,
    },
    {
      id: 'usr-1005',
      fullName: 'Ситора Джураева',
      email: 'invited@mentortaskflow.test',
      role: 'Mentor',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_FRONTEND,
      passwordHash: null,
      createdOffsetDays: 2,
      lastLoginOffsetHours: null,
    },
    {
      id: 'usr-1017',
      fullName: 'Умед Раджабов',
      email: 'mentor-head@mentortaskflow.test',
      role: 'Mentor',
      branchId: BRANCH_HEAD_OFFICE,
      categoryId: CATEGORY_HQ_CSHARP,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 120,
      lastLoginOffsetHours: 8,
    },
    {
      id: 'usr-1018',
      fullName: 'Мадина Юлдашева',
      email: 'mentor-khujand@mentortaskflow.test',
      role: 'Mentor',
      branchId: BRANCH_KHUJAND,
      categoryId: CATEGORY_KHU_CSHARP,
      passwordHash: DEMO_PASSWORD,
      createdOffsetDays: 110,
      lastLoginOffsetHours: 10,
    },

    /* ------------------------------- ростер (заполнение) ------------------------- */
    ...rosterMentors(BRANCH_HEAD_OFFICE, CATEGORY_HQ_CSHARP, 3, 0, 90),
    ...rosterMentors(BRANCH_HEAD_OFFICE, CATEGORY_HQ_PYTHON, 4, 3, 95),
    ...rosterMentors(BRANCH_HEAD_OFFICE, CATEGORY_HQ_FRONTEND, 2, 7, 100),
    ...rosterMentors(BRANCH_KHUJAND, CATEGORY_KHU_CSHARP, 3, 9, 80),
    ...rosterMentors(BRANCH_KHUJAND, CATEGORY_KHU_PYTHON, 3, 12, 75),
    ...rosterMentors(BRANCH_KHUJAND, CATEGORY_KHU_DESIGN, 2, 15, 60),
    ...rosterMentors(BRANCH_BOKHTAR, CATEGORY_BOK_CSHARP, 3, 17, 50),
    ...rosterMentors(BRANCH_BOKHTAR, CATEGORY_BOK_FRONTEND, 1, 1, 45),
  ];

  return seeds.map((seed) => ({
    id: seed.id,
    fullName: seed.fullName,
    email: seed.email,
    role: seed.role,
    adminScope: seed.adminScope ?? null,
    organizationId: ORGANIZATION.id,
    branchId: seed.branchId,
    categoryId: seed.categoryId,
    passwordHash: seed.passwordHash,
    isActive: seed.isActive ?? true,
    tokenVersion: 1,
    failedLoginCount: seed.failedLoginCount ?? 0,
    lockoutUntil: seed.lockoutUntil ?? null,
    createdAt: now - seed.createdOffsetDays * DAY,
    lastLoginAt:
      seed.lastLoginOffsetHours === null || seed.lastLoginOffsetHours === undefined
        ? null
        : now - seed.lastLoginOffsetHours * HOUR,
  }));
}

export function seedDb(): DbSeed {
  const now = Date.now();
  const users = buildUsers(now);

  const securityTokens: SecurityToken[] = [
    {
      token: 'reset-valid-token',
      userId: 'usr-1003',
      purpose: 'ResetPassword',
      expiresAt: now + SEEDED_VALID_TTL,
      usedAt: null,
    },
    {
      token: 'reset-expired-token',
      userId: 'usr-1003',
      purpose: 'ResetPassword',
      expiresAt: now - MINUTE,
      usedAt: null,
    },
    {
      token: 'reset-used-token',
      userId: 'usr-1002',
      purpose: 'ResetPassword',
      expiresAt: now + SEEDED_VALID_TTL,
      usedAt: now - MINUTE,
    },
    {
      token: 'set-valid-token',
      userId: 'usr-1005',
      purpose: 'SetPassword',
      expiresAt: now + SEEDED_VALID_TTL,
      usedAt: null,
    },
    {
      token: 'set-expired-token',
      userId: 'usr-1005',
      purpose: 'SetPassword',
      expiresAt: now - MINUTE,
      usedAt: null,
    },
  ];

  return { users, securityTokens };
}

/** TTL по контракту — применяется к токенам, выпущенным в рантайме. */
export const SECURITY_TOKEN_TTL = {
  ResetPassword: 30 * MINUTE,
  SetPassword: 24 * HOUR,
} as const;

export const ACCESS_TOKEN_TTL = 5 * MINUTE;
export const REFRESH_TOKEN_TTL = 14 * DAY;

export const ACCOUNT_LOCKOUT = {
  maxFailedAttempts: 5,
  durationMs: 15 * MINUTE,
} as const;
