import { apiClient } from './client';
import type { components } from './generated/auth-api';
import { publicClient } from './publicClient';

/**
 * Типизированные вызовы контракта `/api/v1/auth/*`.
 *
 * Все DTO — тонкие псевдонимы над сгенерированным из OpenAPI boundary
 * (`src/api/generated/auth-api.ts`). Собственных копий DTO в коде нет.
 */

export type UserRole = components['schemas']['UserRole'];
export type AdminScope = components['schemas']['AdminScope'];
export type OrganizationSummary = components['schemas']['OrganizationSummary'];
export type BranchSummary = components['schemas']['BranchSummary'];
export type AuthUser = components['schemas']['AuthUser'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type RefreshResponse = components['schemas']['RefreshResponse'];
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest'];
export type ChangePasswordResponse = components['schemas']['ChangePasswordResponse'];
export type ForgotPasswordRequest = components['schemas']['ForgotPasswordRequest'];
export type ForgotPasswordResponse = components['schemas']['ForgotPasswordResponse'];
export type ResetPasswordRequest = components['schemas']['ResetPasswordRequest'];
export type SetPasswordRequest = components['schemas']['SetPasswordRequest'];

export const AUTH_ENDPOINTS = {
  login: '/api/v1/auth/login',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
  me: '/api/v1/auth/me',
  changePassword: '/api/v1/auth/change-password',
  forgotPassword: '/api/v1/auth/forgot-password',
  resetPassword: '/api/v1/auth/reset-password',
  setPassword: '/api/v1/auth/set-password',
} as const;

/* ---------------------------- publicClient ---------------------------- */

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await publicClient.post<LoginResponse>(AUTH_ENDPOINTS.login, payload);
  return data;
}

/**
 * Низкоуровневый вызов ротации. Приложение почти всегда должно использовать
 * `refreshAccessToken()` из `auth/refreshCoordinator` — он гарантирует single-flight.
 */
export async function refresh(): Promise<RefreshResponse> {
  const { data } = await publicClient.post<RefreshResponse>(AUTH_ENDPOINTS.refresh, null);
  return data;
}

export async function logout(): Promise<void> {
  await publicClient.post(AUTH_ENDPOINTS.logout, null);
}

export async function forgotPassword(
  payload: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  const { data } = await publicClient.post<ForgotPasswordResponse>(
    AUTH_ENDPOINTS.forgotPassword,
    payload,
  );
  return data;
}

/** Успешный ответ без тела — намеренно ничего не возвращаем. */
export async function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  await publicClient.post(AUTH_ENDPOINTS.resetPassword, payload);
}

export async function setPassword(payload: SetPasswordRequest): Promise<void> {
  await publicClient.post(AUTH_ENDPOINTS.setPassword, payload);
}

/* ----------------------------- apiClient ------------------------------ */

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>(AUTH_ENDPOINTS.me);
  return data;
}

export async function changePassword(
  payload: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  const { data } = await apiClient.post<ChangePasswordResponse>(
    AUTH_ENDPOINTS.changePassword,
    payload,
  );
  return data;
}

export const authApi = {
  login,
  refresh,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  setPassword,
};
