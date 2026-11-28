import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { listPermissionExceptions } from '@/api/admin';
import { listUsers } from '@/api/users';
import { permissionLabel } from '@/features/users/permissions';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { Avatar, Badge, Group, Row, Section } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Select } from '@/ui/sheet';

/** Who has rights that differ from their role, and a way to change anybody's. */
export default function PermissionsScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const me = useUser();
  const query = useQuery({ queryKey: ['permission-exceptions', me.id], queryFn: listPermissionExceptions });
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>
        {t('Права идут от роли. Здесь можно запретить или разрешить что-то отдельному человеку.')}
      </Text>
      <Select
        label={t('Настроить права человека')}
        value={picked}
        onChange={(userId) => {
          setPicked(null);
          router.push({ pathname: '/permissions/[userId]', params: { userId } });
        }}
        placeholder={t('Выберите пользователя')}
        options={(users.data ?? [])
          .filter((u) => u.isActive && u.id !== me.id && u.role !== 'Admin')
          .map((u) => ({ value: u.id, label: u.fullName, hint: t(u.role === 'Lead' ? 'Тимлид' : 'Ментор') }))}
      />
      <Loaded query={query}>
        {(items) => (
          <Section title={t('Особые права')}>
            <Group>
              {items.length === 0 ? <Row title={t('Исключений нет')} subtitle={t('У всех права по роли.')} /> : null}
              {items.map((item) => (
                <Row
                  key={item.userId}
                  title={item.fullName}
                  subtitle={[
                    item.denied.length ? `${t('Запрещено')}: ${item.denied.map((k) => t(permissionLabel(k))).join(', ')}` : null,
                    item.allowed.length ? `${t('Разрешено')}: ${item.allowed.map((k) => t(permissionLabel(k))).join(', ')}` : null,
                  ].filter(Boolean).join('\n')}
                  leading={<Avatar name={item.fullName} size={36} />}
                  trailing={item.denied.length ? <Badge tone="danger" label={`−${item.denied.length}`} /> : <Badge tone="success" label={`+${item.allowed.length}`} />}
                  onPress={() => router.push({ pathname: '/permissions/[userId]', params: { userId: item.userId } })}
                />
              ))}
            </Group>
          </Section>
        )}
      </Loaded>
    </Page>
  );
}
