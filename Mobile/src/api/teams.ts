import { apiGet, apiSend } from '@/lib/api';

/** `TeamMemberDto`; the server omits null fields. */
export interface TeamMember {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  accountRole: string;
  isMain: boolean;
  isActive: boolean;
  /** What the caller may do with this row — the app offers nothing the server would refuse. */
  assignableRoles: string[];
  canRemove: boolean;
}

export interface TeamCandidate {
  userId: string;
  fullName: string;
  accountRole: string;
  mainTeamName?: string | null;
  assignableRoles: string[];
}

const base = (categoryId: string) => `/api/v1/categories/${categoryId}`;

export const listTeamMembers = (categoryId: string) => apiGet<TeamMember[]>(`${base(categoryId)}/members`);

export const listTeamCandidates = (categoryId: string, search: string) =>
  apiGet<TeamCandidate[]>(`${base(categoryId)}/member-candidates${search ? `?search=${encodeURIComponent(search)}` : ''}`);

export const addTeamMember = (categoryId: string, userId: string, role: string, branchId?: string | null) =>
  apiSend<TeamMember>('POST', `${base(categoryId)}/members`, { userId, role }, branchId);

export const changeTeamRole = (categoryId: string, userId: string, role: string, branchId?: string | null) =>
  apiSend<TeamMember>('PUT', `${base(categoryId)}/members/${userId}`, { role }, branchId);

export const removeTeamMember = (categoryId: string, userId: string, branchId?: string | null) =>
  apiSend<void>('DELETE', `${base(categoryId)}/members/${userId}`, undefined, branchId);
