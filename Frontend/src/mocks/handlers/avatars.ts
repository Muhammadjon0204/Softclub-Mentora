import { http } from 'msw';

import { correlationIdOf, jsonOk } from './shared';

const route = (path: string): string => `*/api/v1/${path}`;

/** GET /api/v1/users/avatars — в моках фотографий нет ни у кого: везде инициалы. */
export const avatarHandlers = [
  http.get(route('users/avatars'), ({ request }) => jsonOk([], correlationIdOf(request))),
];
