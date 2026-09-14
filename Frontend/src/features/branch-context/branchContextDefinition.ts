import { createContext } from 'react';

import type { BranchListItemDto } from '../../api/admin/branches';
import type { BranchSummary } from '../../api/auth';

export interface BranchContextValue {
  /** `null` у Organization Admin означает режим «Все филиалы». */
  selectedBranchId: string | null;
  isAllBranches: boolean;
  /** `true` только для Organization Admin — определяет, рендерить ли selector. */
  canOverrideBranch: boolean;
  availableBranches: BranchListItemDto[];
  isLoadingBranches: boolean;
  branchesError: unknown;
  refetchBranches: () => void;
  /** Фиксированный филиал Branch Admin / Lead / Mentor — для неизменяемого badge. */
  fixedBranch: BranchSummary | null;
  setSelectedBranch: (branchId: string | null) => void;
  clearBranchContext: () => void;
}

export const BranchContext = createContext<BranchContextValue | null>(null);
