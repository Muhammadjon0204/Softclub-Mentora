import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import type { UserRole } from '../api/auth';
import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { dashboardPathForRole } from './roleRedirect';
import { useAuth } from './useAuth';

interface RequireRoleProps {
  allowed: readonly UserRole[];
  children: ReactNode;
}

/**
 * Ролевой guard. Роль берётся из профиля, полученного от API, — не из URL и не из формы.
 * Чужую роль не «запрещаем» экраном 403, а уводим на её собственный дашборд.
 */
export function RequireRole({ allowed, children }: RequireRoleProps): JSX.Element {
  const { status, user } = useAuth();

  if (status === 'bootstrapping') return <AuthBootstrapScreen />;

  if (user === null) return <Navigate to="/login" replace />;

  if (!allowed.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
