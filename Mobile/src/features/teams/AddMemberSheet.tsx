import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Text } from 'react-native';

import { addTeamMember, listTeamCandidates, type TeamCandidate } from '@/api/teams';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { useAction } from '@/ui/feedback';
import { Avatar, Button, Group, Row, SearchBar, Section } from '@/ui/kit';
import { Loaded } from '@/ui/page';
import { Sheet } from '@/ui/sheet';

import { TEAM_ROLE_HINT, teamRoleLabel } from './labels';

const ACCOUNT_LABEL: Record<string, string> = { Admin: 'Администратор', Lead: 'Тимлид', Mentor: 'Ментор' };

/** Two steps on one sheet: pick somebody of the branch, then what they will be in the team. */
export function AddMemberSheet({ categoryId, branchId, onClose }: {
  categoryId: string;
  branchId?: string | null;
  onClose: () => void;
}): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState<TeamCandidate | null>(null);
  const [role, setRole] = useState('');
  const term = useDeferredValue(search.trim());
  const candidates = useQuery({ queryKey: ['team-candidates', categoryId, term], queryFn: () => listTeamCandidates(categoryId, term) });
  const add = useAction(() => addTeamMember(categoryId, person?.userId ?? '', role, branchId), {
    success: 'Участник добавлен в команду',
    onDone: onClose,
  });

  return (
    <Sheet open onClose={onClose} title={t('Добавить в команду')}>
      {person ? (
        <>
          <Group>
            <Row title={person.fullName} subtitle={t('Выбрать другого человека')} leading={<Avatar name={person.fullName} size={36} />} onPress={() => setPerson(null)} />
          </Group>
          <Section title={t('Роль в команде')}>
            <Group>
              {person.assignableRoles.map((option) => (
                <Row
                  key={option}
                  title={t(teamRoleLabel(option))}
                  subtitle={TEAM_ROLE_HINT[option] ? t(TEAM_ROLE_HINT[option]) : null}
                  selected={role === option}
                  onPress={() => setRole(option)}
                />
              ))}
            </Group>
          </Section>
          <Button label={t('Добавить')} onPress={() => add.run()} loading={add.busy} disabled={!role} />
        </>
      ) : (
        <>
          <SearchBar value={search} onChange={setSearch} placeholder={t('Имя или email')} />
          <Loaded query={candidates}>
            {(people) =>
              people.length === 0 ? (
                <Text style={{ color: c.textMuted, textAlign: 'center' }}>{t('Некого добавить: все подходящие люди филиала уже в команде.')}</Text>
              ) : (
                <Group>
                  {people.map((candidate) => (
                    <Row
                      key={candidate.userId}
                      title={candidate.fullName}
                      subtitle={[t(ACCOUNT_LABEL[candidate.accountRole] ?? candidate.accountRole), candidate.mainTeamName].filter(Boolean).join(' · ')}
                      leading={<Avatar name={candidate.fullName} size={36} />}
                      onPress={() => {
                        setPerson(candidate);
                        // The most modest role by default: a lead is appointed on purpose.
                        setRole(candidate.assignableRoles[candidate.assignableRoles.length - 1] ?? '');
                      }}
                    />
                  ))}
                </Group>
              )
            }
          </Loaded>
        </>
      )}
    </Sheet>
  );
}
