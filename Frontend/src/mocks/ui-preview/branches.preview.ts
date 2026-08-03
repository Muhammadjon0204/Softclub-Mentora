/**
 * Демо-данные страницы /admin/branches (UI-прототип, раздел 6 сессии).
 *
 * Отдельный, простой набор — НЕ проходит через реальные MSW-хендлеры и не
 * пересекается с `mocks/domain/organization.ts` (тот питает настоящий
 * Dashboard). Здесь только то, что нужно для визуального прототипа.
 */

export interface PreviewBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  isHeadOffice: boolean;
  adminName: string | null;
  categoriesCount: number;
  mentorsCount: number;
  activeAssignments: number;
  isActive: boolean;
  healthPct: number;
}

export const PREVIEW_BRANCHES: PreviewBranch[] = [
  {
    id: 'branch-hq',
    name: 'Душанбе',
    code: 'DUS-01',
    address: 'г. Душанбе, ул. Рудаки, 22',
    isHeadOffice: true,
    adminName: 'Фируз Алимов',
    categoriesCount: 4,
    mentorsCount: 14,
    activeAssignments: 21,
    isActive: true,
    healthPct: 96,
  },
  {
    id: 'branch-khu',
    name: 'Худжанд',
    code: 'KHU-01',
    address: 'г. Худжанд, ул. Ленина, 5',
    isHeadOffice: false,
    adminName: 'Мадина Юсупова',
    categoriesCount: 3,
    mentorsCount: 8,
    activeAssignments: 10,
    isActive: true,
    healthPct: 89,
  },
  {
    id: 'branch-bok',
    name: 'Бохтар',
    code: 'BOK-01',
    address: 'г. Бохтар, ул. Восеъ, 11',
    isHeadOffice: false,
    adminName: null,
    categoriesCount: 1,
    mentorsCount: 4,
    activeAssignments: 4,
    isActive: true,
    healthPct: 72,
  },
];

/** Для компактного «Распределение пользователей по филиалам» рядом с таблицей. */
export const PREVIEW_BRANCH_USER_DISTRIBUTION: { label: string; count: number }[] = [
  { label: 'Душанбе', count: 22 },
  { label: 'Худжанд', count: 9 },
  { label: 'Бохтар', count: 5 },
];
