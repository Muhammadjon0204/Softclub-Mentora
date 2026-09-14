/**
 * `/admin/branches` reads real data from `GET /branches` (`features/admin-branches/*`,
 * `pages/admin/BranchesPage.tsx`) — only the shared `PreviewBranch` shape survives here.
 * The fixture array and the fixed "users per branch" chart data this file used to hold
 * (`PREVIEW_BRANCHES`, `PREVIEW_BRANCH_USER_DISTRIBUTION`) were deleted once their last real
 * caller (`BranchesPage.tsx`'s distribution widget) was rewired to `useUsersQuery()` — see
 * `docs/INTEGRATION_UI_ISSUES.md` finding #18.
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
