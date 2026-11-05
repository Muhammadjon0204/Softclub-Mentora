import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { getUserPermissions } from '../api/admin/permissions';
import { listProposals } from '../api/proposals';
import { server } from '../mocks/server';

/**
 * Сервер не пишет в JSON поля со значением `null`. Без нормализации `undefined !== null`, и у идеи
 * на рассмотрении появлялась кнопка «Открыть задание»: нашлось при проверке в браузере.
 */
describe('поля, которых сервер не прислал', () => {
  it('у предложения становятся null', async () => {
    server.use(http.get('*/api/v1/proposals', () => HttpResponse.json({
      items: [{ id: 'p1', kind: 'Other', status: 'Pending', canDecide: false }],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    })));

    const { items } = await listProposals();

    expect(items[0]?.assignmentId).toBeNull();
    expect(items[0]?.decisionComment).toBeNull();
  });

  it('у личного права становятся null', async () => {
    server.use(http.get('*/api/v1/permissions/users/u1', () => HttpResponse.json({
      userId: 'u1',
      fullName: 'Имя',
      role: 'Mentor',
      canEdit: true,
      permissions: [{ key: 'reports.view', group: 'data', roleValue: true, effective: true }],
    })));

    const user = await getUserPermissions('u1');

    expect(user.permissions[0]?.override).toBeNull();
  });
});
