import { useContext } from 'react';

import { BranchContext, type BranchContextValue } from './branchContextDefinition';

export function useBranchContext(): BranchContextValue {
  const context = useContext(BranchContext);
  if (context === null) {
    throw new Error('useBranchContext должен вызываться внутри <BranchProvider>');
  }
  return context;
}
