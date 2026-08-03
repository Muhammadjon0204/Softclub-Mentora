import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { useAuth } from './useAuth';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Пускает дальше только аутентифицированных.
 *
 * Пока идёт первичный bootstrap — НИКАКИХ redirect: иначе каждый F5 на защищённой
 * странице выбрасывал бы на /login до того, как отработает silent refresh.
 */
export function RequireAuth({ children }: RequireAuthProps): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') return <AuthBootstrapScreen />;

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
