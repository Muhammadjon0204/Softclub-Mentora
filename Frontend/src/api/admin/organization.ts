import { apiClient } from '../client';

/**
 * Backend отдаёт разный состав полей в зависимости от роли (`OrganizationSummaryDto`
 * для остальных ролей vs `OrganizationDto` для Organization Admin) — решение
 * принимается на сервере, не на клиенте. Единственный сегодняшний вызывающий
 * код (`features/admin-settings`) доступен только Organization Admin, поэтому
 * здесь зафиксирован полный контракт.
 */
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  concurrencyToken: string;
}

/** PUT-тело — `name` единственное изменяемое поле (`slug` неизменяем, `isActive` вне UI). */
export interface UpdateOrganizationRequest {
  name: string;
  concurrencyToken: string;
}

export async function getOrganization(): Promise<OrganizationDto> {
  const { data } = await apiClient.get<OrganizationDto>('/api/v1/organization');
  return data;
}

/** PUT /api/v1/organization — только Organization Admin. Отвечает свежим DTO с новым `concurrencyToken`. */
export async function updateOrganization(request: UpdateOrganizationRequest): Promise<OrganizationDto> {
  const { data } = await apiClient.put<OrganizationDto>('/api/v1/organization', request);
  return data;
}
