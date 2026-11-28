import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Categories/TeamMemberDtos.cs`. */
export interface TeamMemberDto {
  userId: string;
  fullName: string;
  email: string;
  /** Кем человек является в этой команде: `Lead` | `Mentor` | `Member`. */
  role: string;
  accountRole: string;
  isMain: boolean;
  isActive: boolean;
  /** Что вызывающему разрешено с этой строкой — страница не предлагает того, в чём сервер откажет. */
  assignableRoles: string[];
  canRemove: boolean;
  avatarUrl?: string | null;
}

export interface TeamCandidateDto {
  userId: string;
  fullName: string;
  accountRole: string;
  /** Сервер не присылает поле, когда основной команды нет или она не для глаз вызывающего. */
  mainTeamName?: string | null;
  assignableRoles: string[];
  avatarUrl?: string | null;
}

const base = (categoryId: string): string => `/api/v1/categories/${categoryId}`;

export async function listTeamMembers(categoryId: string): Promise<TeamMemberDto[]> {
  const { data } = await apiClient.get<TeamMemberDto[]>(`${base(categoryId)}/members`);
  return data;
}

export async function listTeamCandidates(categoryId: string, search: string): Promise<TeamCandidateDto[]> {
  const { data } = await apiClient.get<TeamCandidateDto[]>(`${base(categoryId)}/member-candidates`, {
    params: search === '' ? undefined : { search },
  });
  return data;
}

export async function addTeamMember(categoryId: string, userId: string, role: string): Promise<TeamMemberDto> {
  const { data } = await apiClient.post<TeamMemberDto>(`${base(categoryId)}/members`, { userId, role });
  return data;
}

export async function changeTeamMemberRole(categoryId: string, userId: string, role: string): Promise<TeamMemberDto> {
  const { data } = await apiClient.put<TeamMemberDto>(`${base(categoryId)}/members/${userId}`, { role });
  return data;
}

export async function removeTeamMember(categoryId: string, userId: string): Promise<void> {
  await apiClient.delete(`${base(categoryId)}/members/${userId}`);
}
