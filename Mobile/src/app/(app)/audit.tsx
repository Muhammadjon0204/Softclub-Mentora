import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react-native';

import { listAudit } from '@/api/admin';
import { listUsers } from '@/api/users';
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, auditTone } from '@/features/audit/labels';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { Badge, Button, Group, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { StateMessage } from '@/ui/primitives';

/** What people did in the system; task history lives in «Журнал заданий». */
export default function AuditScreen(): JSX.Element {
  const { t, locale } = useT();
  const me = useUser();
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const names = new Map((users.data ?? []).map((u) => [u.id, u.fullName]));
  const query = useInfiniteQuery({
    queryKey: ['audit', me.id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listAudit(pageParam),
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
  });

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching && !query.isFetchingNextPage}>
      <Loaded query={query}>
        {(data) => {
          const items = data.pages.flatMap((p) => p.items);
          if (items.length === 0) return <StateMessage title={t('Записей пока нет')} />;
          return (
            <>
              <Group>
                {items.map((e) => {
                  const actor = e.actorType === 'System' ? t('Система') : (names.get(e.actorId ?? '') ?? (e.actorId === me.id ? me.fullName : t(e.actorRole === 'Admin' ? 'Администратор' : e.actorRole === 'Lead' ? 'Тимлид' : 'Пользователь')));
                  return (
                    <Row
                      key={e.id}
                      title={t(AUDIT_ACTION_LABEL[e.action] ?? e.action)}
                      subtitle={`${actor} · ${t(AUDIT_ENTITY_LABEL[e.entityType] ?? e.entityType)}\n${new Date(e.occurredAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                      icon={ScrollText}
                      iconTone={auditTone(e.action, e.result)}
                      meta={e.result !== 'Success' ? <Badge tone="danger" label={t('Отклонено')} /> : undefined}
                    />
                  );
                })}
              </Group>
              {query.hasNextPage ? <Button kind="secondary" label={t('Показать ещё')} loading={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} /> : null}
            </>
          );
        }}
      </Loaded>
    </Page>
  );
}
