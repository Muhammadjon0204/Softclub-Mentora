import { Fragment, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { UserRole } from '../api/auth';
import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { dashboardPathForRole } from './roleRedirect';
import { teamForPath } from './teams';
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
  const { status, user, activeTeamId } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') return <AuthBootstrapScreen />;

  if (user === null) return <Navigate to="/login" replace />;

  // Ссылка из уведомления может вести в другую команду — сначала переключиться, потом пускать.
  if (new URLSearchParams(location.search).has('team')) return <FollowTeamLink />;

  if (!allowed.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  // Ключ по команде: при переключении страницы открываются заново и не несут чужое состояние.
  return <Fragment key={activeTeamId ?? 'account'}>{children}</Fragment>;
}

function FollowTeamLink(): null {
  const { account, activeTeamId, switchTeam } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (account === null) return;
    const path = location.pathname + location.search;
    const params = new URLSearchParams(location.search);
    params.delete('team');
    const query = params.toString();
    switchTeam(teamForPath(account, path, activeTeamId), location.pathname + (query === '' ? '' : `?${query}`));
  }, [account, activeTeamId, location, switchTeam]);

  return null;
}
