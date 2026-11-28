import { switchableTeams } from '../../auth/teams';
import { useAuth } from '../../auth/useAuth';
import { Select } from '../../shared/select';
import { teamRoleLabel } from './teamLabels';

const ACCOUNT = 'account';

/**
 * Где человек сейчас работает. Показывается только тому, кому есть из чего выбирать: администратору,
 * состоящему в команде, и тем, кто в нескольких командах. Выбор перестраивает интерфейс под роль.
 */
export function TeamSwitcher(): JSX.Element | null {
  const { account, activeTeamId, switchTeam } = useAuth();
  if (account === null) return null;

  const teams = switchableTeams(account);
  if (teams.length === 0) return null;

  const main = account.teams?.find((team) => team.isMain);
  const home =
    account.role === 'Admin'
      ? { value: ACCOUNT, label: 'Администрирование' }
      : {
          value: ACCOUNT,
          label: account.category?.name ?? 'Основная команда',
          description: main === undefined ? undefined : teamRoleLabel(main.role),
        };

  return (
    <Select
      ariaLabel="Где вы работаете"
      value={activeTeamId ?? ACCOUNT}
      onValueChange={(value) => { switchTeam(value === ACCOUNT ? null : value); }}
      options={[
        home,
        ...teams.map((team) => ({ value: team.categoryId, label: team.name, description: teamRoleLabel(team.role) })),
      ]}
      fullWidth={false}
      className="min-w-0 flex-1 lg:w-[220px] lg:flex-none"
      panelClassName="min-w-[260px]"
    />
  );
}
