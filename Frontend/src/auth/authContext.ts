import { createContext } from 'react';

import type { AuthUser, ChangePasswordRequest, LoginRequest } from '../api/auth';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

export interface AuthContextValue {
  status: AuthStatus;
  /** Зеркало tokenStore для UI. Заголовок подставляет интерцептор, не компоненты. */
  accessToken: string | null;
  /** Кем человек выступает сейчас: аккаунт как есть либо его роль в выбранной команде. */
  user: AuthUser | null;
  /** Сам аккаунт — для переключателя команд; на выбор команды не меняется. */
  account: AuthUser | null;
  /** `null` — основная команда или панель администратора. */
  activeTeamId: string | null;
  /** Переключает рабочую команду и открывает `to` (по умолчанию — обзор новой роли). */
  switchTeam: (teamId: string | null, to?: string) => void;
  isAuthenticated: boolean;
  /** `requestedPath` — куда человек шёл до входа: по нему выбирается команда. */
  login: (credentials: LoginRequest, requestedPath?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  /** Подменяет профиль после того, как человек сам его изменил (например, имя на странице профиля). */
  updateUser: (next: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
