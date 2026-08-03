import { apiClient } from '../client';

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
}

export async function getOrganization(): Promise<OrganizationDto> {
  const { data } = await apiClient.get<OrganizationDto>('/api/v1/organization');
  return data;
}
