import { http } from 'msw';

import { ORGANIZATION } from '../domain/organization';
import { authenticateAdmin, correlationIdOf, jsonOk } from './shared';

const route = (path: string): string => `*/api/v1/${path}`;

/** GET /api/v1/organization — минимальный состав данных доступен любому Admin (ТЗ ORG-003). */
export const organizationHandlers = [
  http.get(route('organization'), ({ request }) => {
    const instance = '/api/v1/organization';
    const auth = authenticateAdmin(request, instance);
    if (!auth.ok) return auth.response;

    const correlationId = correlationIdOf(request);
    return jsonOk(
      {
        id: ORGANIZATION.id,
        name: ORGANIZATION.name,
        slug: ORGANIZATION.slug,
      },
      correlationId,
    );
  }),
];
