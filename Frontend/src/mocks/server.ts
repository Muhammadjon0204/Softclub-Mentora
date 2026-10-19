import { setupServer } from 'msw/node';

import { authHandlers } from './handlers/auth';
import { avatarHandlers } from './handlers/avatars';
import { branchesHandlers } from './handlers/branches';
import { dashboardHandlers } from './handlers/dashboard';
import { organizationHandlers } from './handlers/organization';

/** Node-версия тех же хендлеров — используется в Vitest. */
export const server = setupServer(
  ...authHandlers,
  ...avatarHandlers,
  ...organizationHandlers,
  ...branchesHandlers,
  ...dashboardHandlers,
);
