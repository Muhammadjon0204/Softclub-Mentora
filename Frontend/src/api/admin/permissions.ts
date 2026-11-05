import { apiClient } from '../client';

/** `Backend/src/MentorTaskFlow.Contracts/Access/PermissionDtos.cs`. */
export type PermissionSubject = 'BranchAdmin' | 'Lead' | 'Mentor';

export interface RolePermissionCell {
  subject: PermissionSubject;
  default: boolean;
  /** Настройка организации; `null`, пока роль на значении по умолчанию. */
  rule: boolean | null;
  effective: boolean;
}

export interface RolePermissionRow {
  key: string;
  group: string;
  cells: RolePermissionCell[];
}

export interface UserPermissionRow {
  key: string;
  group: string;
  roleValue: boolean;
  /** Личное исключение; `null`, пока его нет. */
  override: boolean | null;
  effective: boolean;
}

export interface UserPermissions {
  userId: string;
  fullName: string;
  role: string;
  canEdit: boolean;
  permissions: UserPermissionRow[];
}

export interface PermissionException {
  userId: string;
  fullName: string;
  role: string;
  branchName: string | null;
  categoryName: string | null;
  allowed: string[];
  denied: string[];
}

/** Сервер не пишет в JSON поля со значением `null`, а здесь `null` значит «как по умолчанию». */
function normalizeMatrix(rows: RolePermissionRow[]): RolePermissionRow[] {
  return rows.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell, rule: cell.rule ?? null })) }));
}

function normalizeUser(user: UserPermissions): UserPermissions {
  return { ...user, permissions: user.permissions.map((row) => ({ ...row, override: row.override ?? null })) };
}

export async function getRoleMatrix(): Promise<RolePermissionRow[]> {
  const { data } = await apiClient.get<RolePermissionRow[]>('/api/v1/permissions/roles');
  return normalizeMatrix(data);
}

export async function setRoleRule(subject: PermissionSubject, permission: string, allowed: boolean | null): Promise<RolePermissionRow[]> {
  const { data } = await apiClient.put<RolePermissionRow[]>('/api/v1/permissions/roles', { subject, permission, allowed });
  return normalizeMatrix(data);
}

export async function getPermissionExceptions(): Promise<PermissionException[]> {
  const { data } = await apiClient.get<PermissionException[]>('/api/v1/permissions/exceptions');
  return data;
}

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const { data } = await apiClient.get<UserPermissions>(`/api/v1/permissions/users/${userId}`);
  return normalizeUser(data);
}

export async function setUserPermission(userId: string, permission: string, allowed: boolean | null): Promise<UserPermissions> {
  const { data } = await apiClient.put<UserPermissions>(`/api/v1/permissions/users/${userId}`, {
    changes: [{ permission, allowed }],
  });
  return normalizeUser(data);
}
