import { createContext } from 'react';

import type { AuthUser, ChangePasswordRequest, LoginRequest } from '../api/auth';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

export interface AuthContextValue {
  status: AuthStatus;
  /** Зеркало tokenStore для UI. Заголовок подставляет интерцептор, не компоненты. */
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
