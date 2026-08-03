import { apiClient } from '../client';

export interface BranchListItemDto {
  id: string;
  name: string;
  code: string;
  isHeadOffice: boolean;
  isActive: boolean;
}

/** GET /api/v1/branches — только Organization Admin (используется branch selector'ом). */
export async function listBranches(): Promise<BranchListItemDto[]> {
  const { data } = await apiClient.get<{ items: BranchListItemDto[] }>('/api/v1/branches');
  return data.items;
}
