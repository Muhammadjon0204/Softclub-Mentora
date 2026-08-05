/**
 * Единая справочная таблица трёх preview-филиалов организации. Разные preview
 * mock-модули исторически ссылаются на филиал по-разному: `users.preview.ts`/
 * `categories.preview.ts` хранят «сырое» институциональное имя (`branchName`,
 * то же самое, что `mocks/domain/organization.ts` отдаёт реальному `AuthUser.branch.name`),
 * а `branches.preview.ts` хранит готовое городское имя как `PreviewBranch.name` +
 * собственный `id`. Этот файл — единственное место, которое умеет конвертировать
 * между `id`, «сырым» именем и городским display-именем, чтобы Users/Branches
 * features не дублировали каждый свою версию маппинга.
 */

export interface BranchDirectoryEntry {
  /** Совпадает с `PreviewBranch.id` в `branches.preview.ts`. */
  id: string;
  /** Совпадает с `PreviewUser.branchName` / `PreviewCategory.branchName` и с `AuthUser.branch.name`. */
  rawName: string;
  /** Городское имя для UI — совпадает с `PreviewBranch.name`. */
  displayName: string;
}

/**
 * `let`, не `const`: филиалы, созданные через `BranchFormDrawer` во время
 * сессии, дописываются сюда через `registerBranchDirectoryEntry` — иначе
 * Users-формы (`UserForm`, `ChangeUserRoleDialog`, `TransferUserDialog`) не
 * увидят новый филиал в select. У новых филиалов «сырое» и городское имя
 * совпадают — искусственного институционального имени для них нет.
 */
export let BRANCH_DIRECTORY: BranchDirectoryEntry[] = [
  { id: 'branch-hq', rawName: 'Главный офис', displayName: 'Душанбе' },
  { id: 'branch-khu', rawName: 'Филиал Худжанд', displayName: 'Худжанд' },
  { id: 'branch-bok', rawName: 'Филиал Бохтар', displayName: 'Бохтар' },
];

export function registerBranchDirectoryEntry(entry: BranchDirectoryEntry): void {
  if (BRANCH_DIRECTORY.some((existing) => existing.id === entry.id)) return;
  BRANCH_DIRECTORY = [...BRANCH_DIRECTORY, entry];
}

export function branchDisplayName(rawName: string): string {
  return BRANCH_DIRECTORY.find((entry) => entry.rawName === rawName)?.displayName ?? rawName;
}

export function branchIdFromRawName(rawName: string): string | null {
  return BRANCH_DIRECTORY.find((entry) => entry.rawName === rawName)?.id ?? null;
}

export function branchRawNameFromId(id: string): string | null {
  return BRANCH_DIRECTORY.find((entry) => entry.id === id)?.rawName ?? null;
}
