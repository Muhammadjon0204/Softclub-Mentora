/**
 * Статические справочные данные организации: Organization -> Branch -> Category.
 *
 * Это НЕ мутируемое состояние mock-«сервера» (в отличие от `mocks/db.ts`) —
 * это неизменный справочник, соответствующий иерархии ТЗ 2.2 (раздел 38.1).
 * Категории с одинаковым названием в разных филиалах — разные записи с разными
 * `id`: "C# / Главный офис" и "C# / Филиал Худжанд" не имеют ничего общего.
 */

export interface MockOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface MockBranch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string;
  timeZoneId: string;
  isHeadOffice: boolean;
  isActive: boolean;
}

export interface MockCategory {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  description: string;
  /** Один из фиксированного набора спокойных оттенков — не случайный цвет. */
  colorToken: 'indigo' | 'blue' | 'cyan';
  isActive: boolean;
  timeZoneId: string;
  defaultAssignmentDueDays: number;
  allowLateSubmission: boolean;
}

export const ORGANIZATION: MockOrganization = {
  id: 'org-softclub',
  name: 'SoftClub IT Academy',
  slug: 'softclub-academy',
};

export const BRANCH_HEAD_OFFICE = 'branch-hq';
export const BRANCH_KHUJAND = 'branch-khu';
export const BRANCH_BOKHTAR = 'branch-bok';

export const BRANCHES: MockBranch[] = [
  {
    id: BRANCH_HEAD_OFFICE,
    organizationId: ORGANIZATION.id,
    name: 'Главный офис',
    code: 'HQ-DUS',
    address: 'г. Душанбе, ул. Рудаки, 22',
    timeZoneId: 'Asia/Dushanbe',
    isHeadOffice: true,
    isActive: true,
  },
  {
    id: BRANCH_KHUJAND,
    organizationId: ORGANIZATION.id,
    name: 'Филиал Худжанд',
    code: 'KHU-01',
    address: 'г. Худжанд, ул. Ленина, 5',
    timeZoneId: 'Asia/Dushanbe',
    isHeadOffice: false,
    isActive: true,
  },
  {
    id: BRANCH_BOKHTAR,
    organizationId: ORGANIZATION.id,
    name: 'Филиал Бохтар',
    code: 'BOK-01',
    address: 'г. Бохтар, ул. Восеъ, 11',
    timeZoneId: 'Asia/Dushanbe',
    isHeadOffice: false,
    isActive: true,
  },
];

export function findBranch(id: string): MockBranch | undefined {
  return BRANCHES.find((branch) => branch.id === id);
}

export function branchSummary(branchId: string | null): { id: string; name: string; code: string; isHeadOffice: boolean } | null {
  if (branchId === null) return null;
  const branch = findBranch(branchId);
  if (branch === undefined) return null;
  return { id: branch.id, name: branch.name, code: branch.code, isHeadOffice: branch.isHeadOffice };
}

/**
 * Категории намеренно дублируют название «C#» в двух филиалах — это
 * контрольный случай изоляции (ТЗ 2.2, TEN-002a): одноимённые категории
 * являются разными сущностями без единого общего пользователя или задания.
 */
export const CATEGORIES: MockCategory[] = [
  {
    id: 'cat-hq-csharp',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_HEAD_OFFICE,
    name: 'C#',
    description: 'Backend-разработка на ASP.NET Core',
    colorToken: 'indigo',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 3,
    allowLateSubmission: true,
  },
  {
    id: 'cat-hq-python',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_HEAD_OFFICE,
    name: 'Python',
    description: 'Алгоритмы и структуры данных',
    colorToken: 'blue',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 3,
    allowLateSubmission: true,
  },
  {
    id: 'cat-hq-frontend',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_HEAD_OFFICE,
    name: 'Frontend',
    description: 'React, TypeScript, UI-инженерия',
    colorToken: 'cyan',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 4,
    allowLateSubmission: false,
  },
  {
    id: 'cat-khu-csharp',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_KHUJAND,
    name: 'C#',
    description: 'Backend-разработка на ASP.NET Core',
    colorToken: 'indigo',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 3,
    allowLateSubmission: true,
  },
  {
    id: 'cat-khu-python',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_KHUJAND,
    name: 'Python',
    description: 'Основы программирования',
    colorToken: 'blue',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 3,
    allowLateSubmission: true,
  },
  {
    id: 'cat-khu-design',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_KHUJAND,
    name: 'Design',
    description: 'UI/UX-дизайн и прототипирование',
    colorToken: 'cyan',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 5,
    allowLateSubmission: true,
  },
  {
    id: 'cat-bok-csharp',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_BOKHTAR,
    name: 'C#',
    description: 'Backend-разработка на ASP.NET Core',
    colorToken: 'indigo',
    isActive: true,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 3,
    allowLateSubmission: true,
  },
  {
    id: 'cat-bok-frontend',
    organizationId: ORGANIZATION.id,
    branchId: BRANCH_BOKHTAR,
    name: 'Frontend',
    description: 'React, TypeScript, UI-инженерия',
    colorToken: 'cyan',
    isActive: false,
    timeZoneId: 'Asia/Dushanbe',
    defaultAssignmentDueDays: 4,
    allowLateSubmission: true,
  },
];

export function categoriesOfBranch(branchId: string): MockCategory[] {
  return CATEGORIES.filter((category) => category.branchId === branchId);
}

export function categorySummary(categoryId: string | null): { id: string; name: string; timeZoneId: string } | null {
  if (categoryId === null) return null;
  const category = findCategory(categoryId);
  if (category === undefined) return null;
  return { id: category.id, name: category.name, timeZoneId: category.timeZoneId };
}

export function findCategory(id: string): MockCategory | undefined {
  return CATEGORIES.find((category) => category.id === id);
}
