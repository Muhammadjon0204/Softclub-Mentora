import { router } from 'expo-router';

import { useT } from '@/lib/i18n';
import { useAccount, useSession } from '@/lib/session';
import { switchableTeams, useActiveTeam } from '@/lib/team';
import { Select } from '@/ui/sheet';

import { teamRoleLabel } from './labels';

const ACCOUNT = 'account';

/**
 * Where the person is working. Shown only to somebody with a choice — an administrator who is in a
 * team, or a person in several. Choosing rebuilds the app around the role there.
 */
export function TeamPicker(): JSX.Element | null {
  const { t } = useT();
  const account = useAccount();
  const active = useActiveTeam();
  const { switchTeam } = useSession();
  const teams = switchableTeams(account);
  if (teams.length === 0) return null;

  const main = account.teams?.find((team) => team.isMain);
  const home =
    account.role === 'Admin'
      ? { value: ACCOUNT, label: t('Администрирование'), hint: account.branch?.name }
      : { value: ACCOUNT, label: account.category?.name ?? t('Основная команда'), hint: main ? t(teamRoleLabel(main.role)) : null };

  return (
    <Select
      label={t('Где вы работаете')}
      value={active ?? ACCOUNT}
      options={[home, ...teams.map((team) => ({ value: team.categoryId, label: team.name, hint: t(teamRoleLabel(team.role)) }))]}
      onChange={(value) => {
        // The sections differ from role to role, so start from the overview of the new one.
        router.navigate('/');
        switchTeam(value === ACCOUNT ? null : value);
      }}
    />
  );
}
