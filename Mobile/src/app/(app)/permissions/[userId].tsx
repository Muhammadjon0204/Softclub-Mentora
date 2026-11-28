import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { getUserPermissions, setUserPermissions, type UserPermissions } from '@/api/admin';
import { getUser } from '@/api/users';
import { Space } from '@/constants/theme';
import { PERMISSION_INFO } from '@/features/users/permissions';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/useColors';
import { useAction } from '@/ui/feedback';
import { Button, Card, Chips } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';

type Choice = 'role' | 'allow' | 'deny';
const toChoice = (override: boolean | null | undefined): Choice => (override === true ? 'allow' : override === false ? 'deny' : 'role');

export default function UserPermissionsScreen(): JSX.Element {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const query = useQuery({ queryKey: ['permissions', userId], queryFn: () => getUserPermissions(userId) });
  return (
    <Page>
      <Loaded query={query}>{(data) => <Editor key={data.permissions.map((p) => String(p.override)).join()} data={data} />}</Loaded>
    </Page>
  );
}

function Editor({ data }: { data: UserPermissions }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const user = useQuery({ queryKey: ['user', data.userId], queryFn: () => getUser(data.userId) });
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(data.permissions.map((p) => [p.key, toChoice(p.override)])),
  );
  const changes = data.permissions
    .filter((p) => choices[p.key] !== toChoice(p.override))
    .map((p) => ({ permission: p.key, allowed: choices[p.key] === 'role' ? null : choices[p.key] === 'allow' }));
  const save = useAction(() => setUserPermissions(data.userId, changes, user.data?.branchId), { success: 'Права сохранены' });

  return (
    <>
      <View style={{ gap: Space.xs }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{data.fullName}</Text>
        {!data.canEdit ? <Text style={{ color: c.textMuted }}>{t('Изменить права этого человека вы не можете.')}</Text> : null}
      </View>
      {data.permissions.map((p) => {
        const info = PERMISSION_INFO[p.key];
        const choice = choices[p.key] ?? 'role';
        const effective = choice === 'role' ? p.roleValue : choice === 'allow';
        return (
          <Card key={p.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Space.md }}>
              <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: '600' }}>{t(info?.label ?? p.key)}</Text>
              <Text style={{ color: effective ? c.success : c.danger, fontSize: 13, fontWeight: '700' }}>{t(effective ? 'Может' : 'Не может')}</Text>
            </View>
            {info ? <Text style={{ color: c.textMuted, fontSize: 13 }}>{t(info.hint)}</Text> : null}
            {data.canEdit ? (
              <Chips
                inset={false}
                value={choice}
                onChange={(next) => setChoices((prev) => ({ ...prev, [p.key]: next }))}
                options={[
                  { value: 'role', label: t('Как у роли') },
                  { value: 'allow', label: t('Разрешить') },
                  { value: 'deny', label: t('Запретить') },
                ]}
              />
            ) : null}
          </Card>
        );
      })}
      {data.canEdit ? <Button label={t('Сохранить права')} onPress={() => save.run()} loading={save.busy} disabled={changes.length === 0} /> : null}
    </>
  );
}
