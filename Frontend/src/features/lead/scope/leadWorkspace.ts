/**
 * Статический справочник Category -> Branch -> Organization для Lead-раздела,
 * плюс справочник Mentor (той же формы, что `admin-preview/branchDirectory.ts`
 * держит для Branch — см. комментарий в том файле про причину дублирования:
 * preview-фичи не читают `mocks/domain/*` напрямую, они читают собственный
 * frontend-owned справочник тех же id/имён).
 *
 * ТЗ 2.2, раздел 8.3: Lead принадлежит ровно одной активной Category одного
 * Branch. `AuthUser.categoryId` — единственное поле, из которого определяется
 * scope; сам справочник только переводит id в отображаемые имена.
 */

export interface CategoryDirectoryEntry {
  id: string;
  name: string;
  branchId: string;
  /** «Сырое» институциональное имя филиала — совпадает с `AuthUser.branch.name`. */
  branchRawName: string;
  /** Городское display-имя (то же соответствие, что и `branchDirectory.ts`). */
  branchDisplayName: string;
  organizationName: string;
  timeZoneId: string;
  isActive: boolean;
}

export const CATEGORY_DIRECTORY: Record<string, CategoryDirectoryEntry> = {
  'cat-hq-csharp': {
    id: 'cat-hq-csharp',
    name: 'C#',
    branchId: 'branch-hq',
    branchRawName: 'Главный офис',
    branchDisplayName: 'Душанбе',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-hq-python': {
    id: 'cat-hq-python',
    name: 'Python',
    branchId: 'branch-hq',
    branchRawName: 'Главный офис',
    branchDisplayName: 'Душанбе',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-hq-frontend': {
    id: 'cat-hq-frontend',
    name: 'Frontend',
    branchId: 'branch-hq',
    branchRawName: 'Главный офис',
    branchDisplayName: 'Душанбе',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-khu-csharp': {
    id: 'cat-khu-csharp',
    name: 'C#',
    branchId: 'branch-khu',
    branchRawName: 'Филиал Худжанд',
    branchDisplayName: 'Худжанд',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-khu-python': {
    id: 'cat-khu-python',
    name: 'Python',
    branchId: 'branch-khu',
    branchRawName: 'Филиал Худжанд',
    branchDisplayName: 'Худжанд',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-khu-design': {
    id: 'cat-khu-design',
    name: 'Design',
    branchId: 'branch-khu',
    branchRawName: 'Филиал Худжанд',
    branchDisplayName: 'Худжанд',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
  'cat-bok-csharp': {
    id: 'cat-bok-csharp',
    name: 'C#',
    branchId: 'branch-bok',
    branchRawName: 'Филиал Бохтар',
    branchDisplayName: 'Бохтар',
    organizationName: 'SoftClub IT Academy',
    timeZoneId: 'Asia/Dushanbe',
    isActive: true,
  },
};

export function categoryDirectoryEntry(categoryId: string): CategoryDirectoryEntry | undefined {
  return CATEGORY_DIRECTORY[categoryId];
}

export type MentorStatus = 'Active' | 'Invited' | 'Locked';

export interface MentorDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  categoryId: string;
  branchId: string;
  status: MentorStatus;
  /** Смещение от `MOCK_NOW` в часах для «последняя активность» — `null`, если ни разу не заходил. */
  lastActiveOffsetHours: number | null;
  createdOffsetDays: number;
}

/**
 * Зеркалит подмножество `mocks/scenarios.ts` (реальные id/имена seed-пользователей
 * mock-сервера) — те же люди, что видны при входе как Lead в MSW-режиме, плюс
 * ростер для количества. Три категории: своя (`cat-hq-csharp`) и две чужие
 * (`cat-hq-frontend` — тот же Branch, `cat-khu-csharp` — тот же Category name,
 * другой Branch) нужны как контрольные fixtures изоляции (ТЗ 2.2, TEN-002a).
 */
export const MENTOR_DIRECTORY: MentorDirectoryEntry[] = [
  // --- cat-hq-csharp: собственная категория Lead (lead-head@mentortaskflow.test) ---
  { id: 'usr-1017', fullName: 'Умед Раджабов', email: 'mentor-head@mentortaskflow.test', categoryId: 'cat-hq-csharp', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 8, createdOffsetDays: 120 },
  { id: 'usr-1004', fullName: 'Рустам Ниёзов', email: 'locked@mentortaskflow.test', categoryId: 'cat-hq-csharp', branchId: 'branch-hq', status: 'Locked', lastActiveOffsetHours: 200, createdOffsetDays: 140 },
  { id: 'usr-ros-cat-hq-csharp-1', fullName: 'Олим Назаров', email: 'roster.cat-hq-csharp-1@softclub-academy.test', categoryId: 'cat-hq-csharp', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 6, createdOffsetDays: 90 },
  { id: 'usr-ros-cat-hq-csharp-2', fullName: 'Дилноза Каримова', email: 'roster.cat-hq-csharp-2@softclub-academy.test', categoryId: 'cat-hq-csharp', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 12, createdOffsetDays: 91 },
  { id: 'usr-ros-cat-hq-csharp-3', fullName: 'Хуршед Латипов', email: 'roster.cat-hq-csharp-3@softclub-academy.test', categoryId: 'cat-hq-csharp', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 18, createdOffsetDays: 92 },

  // --- cat-hq-frontend: чужая категория, тот же Branch (изоляция level 2) ---
  { id: 'usr-1003', fullName: 'Нилуфар Каримова', email: 'mentor@mentortaskflow.test', categoryId: 'cat-hq-frontend', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 6, createdOffsetDays: 150 },
  { id: 'usr-1005', fullName: 'Ситора Джураева', email: 'invited@mentortaskflow.test', categoryId: 'cat-hq-frontend', branchId: 'branch-hq', status: 'Invited', lastActiveOffsetHours: null, createdOffsetDays: 2 },
  { id: 'usr-ros-cat-hq-frontend-1', fullName: 'Наргис Файзуллоева', email: 'roster.cat-hq-frontend-1@softclub-academy.test', categoryId: 'cat-hq-frontend', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 24, createdOffsetDays: 100 },
  { id: 'usr-ros-cat-hq-frontend-2', fullName: 'Сухроб Эргашев', email: 'roster.cat-hq-frontend-2@softclub-academy.test', categoryId: 'cat-hq-frontend', branchId: 'branch-hq', status: 'Active', lastActiveOffsetHours: 30, createdOffsetDays: 101 },

  // --- cat-khu-csharp: та же категория «C#», другой Branch (изоляция level 1) ---
  { id: 'usr-1018', fullName: 'Мадина Юлдашева', email: 'mentor-khujand@mentortaskflow.test', categoryId: 'cat-khu-csharp', branchId: 'branch-khu', status: 'Active', lastActiveOffsetHours: 10, createdOffsetDays: 110 },
  { id: 'usr-ros-cat-khu-csharp-1', fullName: 'Искандар Валиев', email: 'roster.cat-khu-csharp-1@softclub-academy.test', categoryId: 'cat-khu-csharp', branchId: 'branch-khu', status: 'Active', lastActiveOffsetHours: 14, createdOffsetDays: 80 },
  { id: 'usr-ros-cat-khu-csharp-2', fullName: 'Фотима Расулова', email: 'roster.cat-khu-csharp-2@softclub-academy.test', categoryId: 'cat-khu-csharp', branchId: 'branch-khu', status: 'Active', lastActiveOffsetHours: 20, createdOffsetDays: 81 },
];

export function mentorsOfCategory(categoryId: string): MentorDirectoryEntry[] {
  return MENTOR_DIRECTORY.filter((mentor) => mentor.categoryId === categoryId);
}

export function findMentor(id: string): MentorDirectoryEntry | undefined {
  return MENTOR_DIRECTORY.find((mentor) => mentor.id === id);
}

/** Активные Mentor категории — единственные легитимные кандидаты в SearchSelect назначения (ТЗ 10.6, composite FK). */
export function activeMentorsOfCategory(categoryId: string): MentorDirectoryEntry[] {
  return mentorsOfCategory(categoryId).filter((mentor) => mentor.status !== 'Invited');
}
