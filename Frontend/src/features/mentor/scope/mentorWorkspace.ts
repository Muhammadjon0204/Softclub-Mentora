/**
 * Статический справочник Category -> Branch -> Organization для Mentor-раздела
 * (та же форма и та же причина дублирования, что и `features/lead/scope/leadWorkspace.ts`
 * — preview-фичи не читают `mocks/domain/*` напрямую).
 *
 * Mentor принадлежит ровно одной активной Category одного Branch — то же
 * правило, что для Lead (ТЗ 8.4). `AuthUser.categoryId` — единственное поле,
 * из которого определяется scope; справочник только переводит id в имена.
 *
 * Нет отдельного справочника "учеников": по доменной модели ТЗ 2.2 (раздел
 * 10, Приложение A) у Mentor нет подчинённых сущностей — Assignment
 * назначается Lead непосредственно Mentor, тот выполняет и отправляет
 * Submission. Роли "Student" в системе не существует (раздел 7 — «Студенты
 * курса… не являются пользователями системы напрямую»).
 */

export interface CategoryDirectoryEntry {
  id: string;
  name: string;
  branchId: string;
  /** «Сырое» институциональное имя филиала — совпадает с `AuthUser.branch.name`. */
  branchRawName: string;
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
