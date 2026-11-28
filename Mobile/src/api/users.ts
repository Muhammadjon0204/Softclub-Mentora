import { apiGet, apiGetAll, apiSend } from '@/lib/api';

/** `UserDto`; the server omits null fields. */
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'Admin' | 'Lead' | 'Mentor';
  adminScope?: 'Organization' | 'Branch' | null;
  branchId?: string | null;
  categoryId?: string | null;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  concurrencyToken: string;
  branch?: { id: string; name: string } | null;
  /** The person's teams, the main one first; a lead is told of their own only. */
  teams?: { categoryId: string; name: string; role: string; isMain: boolean }[] | null;
}

export const listUsers = () => apiGetAll<User>('/api/v1/users');
export const getUser = (id: string) => apiGet<User>(`/api/v1/users/${id}`);

export const createUser = (
  body: {
    fullName: string;
    email: string;
    role: User['role'];
    adminScope?: string | null;
    categoryId?: string | null;
    /** `Member` — works in the team without teaching. Only with the role `Mentor`. */
    teamRole?: 'Member';
  },
  branchId?: string | null,
) => apiSend<User>('POST', '/api/v1/users', body, branchId);

export const renameUser = (user: User, fullName: string) =>
  apiSend<User>('PATCH', `/api/v1/users/${user.id}`, { fullName, concurrencyToken: user.concurrencyToken }, user.branchId);

export const setUserActive = (user: User, active: boolean) =>
  apiSend<User>('POST', `/api/v1/users/${user.id}/${active ? 'activate' : 'deactivate'}`, { concurrencyToken: user.concurrencyToken }, user.branchId);

export const resendInvitation = (user: User) =>
  apiSend<void>('POST', `/api/v1/users/${user.id}/resend-invitation`, undefined, user.branchId);

export const changeRole = (user: User, role: User['role'], reason: string, categoryId: string | null) =>
  apiSend<User>(
    'POST',
    `/api/v1/users/${user.id}/change-role`,
    {
      role,
      reason,
      concurrencyToken: user.concurrencyToken,
      adminScope: role === 'Admin' ? 'Branch' : null,
      branchId: role === 'Admin' ? user.branchId : null,
      categoryId,
    },
    user.branchId,
  );

export const changeCategory = (user: User, newCategoryId: string, reason: string) =>
  apiSend<User>('POST', `/api/v1/users/${user.id}/change-category`, { newCategoryId, reason, concurrencyToken: user.concurrencyToken }, user.branchId);
