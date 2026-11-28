import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { listNotifications, retryNotification, type Notification } from '@/api/admin';
import { listUsers } from '@/api/users';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAction } from '@/ui/feedback';
import { Badge, Button, Chips, Group, Info, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { StateMessage } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';

const STATUS: Record<string, { label: string; tone: 'neutral' | 'brand' | 'success' | 'danger' }> = {
  Pending: { label: 'В очереди', tone: 'neutral' },
  Processing: { label: 'Обрабатывается', tone: 'brand' },
  Sent: { label: 'Отправлено', tone: 'success' },
  DeadLetter: { label: 'Ошибка доставки', tone: 'danger' },
};

const EVENT: Record<string, string> = {
  AssignmentAssigned: 'Задание назначено',
  AssignmentSuggested: 'Предложено задание',
  AssignmentReassigned: 'Задание переназначено',
  SubmissionUploaded: 'Загружено решение',
  LateSubmissionUploaded: 'Загружено решение с опозданием',
  SubmissionReceipt: 'Подтверждение отправки ментору',
  ReviewApproved: 'Решение одобрено',
  ReviewNeedsRework: 'Решение отправлено на доработку',
  CrmReportSent: 'Отчёт по группе отправлен',
  DeadlineReminder: 'Напоминание о дедлайне',
  AssignmentOverdue: 'Задание просрочено',
  AssignmentCancelled: 'Задание отменено',
  AssignmentDeadlineChanged: 'Срок задания изменён',
  AssignmentDetailsChanged: 'Задание исправлено',
  ProposalSubmitted: 'Новое предложение ментора',
  ProposalApproved: 'Предложение принято',
  ProposalRejected: 'Предложение отклонено',
  SchedulerNoActiveMentor: 'Нет активного ментора',
  CategoryWithoutLead: 'Направление без руководителя',
  BranchDeactivated: 'Филиал деактивирован',
  BranchActivated: 'Филиал активирован',
  UserBranchChanged: 'Пользователь переведён в филиал',
  BranchWithoutAdmin: 'Филиал без администратора',
  OrganizationSystemAlert: 'Системное оповещение',
  NotificationDeadLetter: 'Сбой доставки уведомлений',
  UserInvitation: 'Приглашение пользователя',
};

export default function NotificationsScreen(): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const me = useUser();
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Notification | null>(null);
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const names = new Map((users.data ?? []).map((u) => [u.id, u.fullName]));
  const query = useInfiniteQuery({
    queryKey: ['notifications', me.id, status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listNotifications(pageParam, status === 'all' ? '' : status),
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
  });
  const retry = useAction((id: string) => retryNotification(id), { success: 'Поставлено на повторную отправку', onDone: () => setSelected(null) });
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const recipient = (id: string) => names.get(id) ?? (id === me.id ? me.fullName : '—');

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching && !query.isFetchingNextPage}>
      <Chips value={status} onChange={setStatus} options={[{ value: 'all', label: t('Все') }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: t(s.label) }))]} />
      <Loaded query={query}>
        {(data) => {
          const items = data.pages.flatMap((p) => p.items);
          if (items.length === 0) return <StateMessage title={t('Здесь пока пусто')} />;
          return (
            <>
              <Group>
                {items.map((n) => {
                  const s = STATUS[n.status] ?? { label: n.status, tone: 'neutral' as const };
                  return (
                    <Row
                      key={n.id}
                      title={t(EVENT[n.eventType] ?? n.eventType)}
                      subtitle={`${recipient(n.userId)} · ${n.channel} · ${when(n.createdAt)}`}
                      icon={n.channel === 'Telegram' ? Send : Mail}
                      iconTone={s.tone}
                      meta={<Badge label={t(s.label)} tone={s.tone} />}
                      onPress={() => setSelected(n)}
                    />
                  );
                })}
              </Group>
              {query.hasNextPage ? <Button kind="secondary" label={t('Показать ещё')} loading={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} /> : null}
            </>
          );
        }}
      </Loaded>
      {selected ? (
        <Sheet open onClose={() => setSelected(null)} title={t(EVENT[selected.eventType] ?? selected.eventType)}>
          <Group>
            <Info label={t('Кому')} value={recipient(selected.userId)} />
            <Info label={t('Канал')} value={selected.channel} />
            <Info label={t('Статус')} value={t(STATUS[selected.status]?.label ?? selected.status)} />
            <Info label={t('Попыток')} value={String(selected.attempts)} />
            <Info label={t('Создано')} value={when(selected.createdAt)} />
            {selected.sentAt ? <Info label={t('Отправлено')} value={when(selected.sentAt)} /> : null}
          </Group>
          {selected.lastError ? <Text style={{ color: c.danger, fontSize: 13, lineHeight: 19 }} selectable>{selected.lastError}</Text> : null}
          {selected.status === 'DeadLetter' ? <Button label={t('Отправить ещё раз')} loading={retry.busy} onPress={() => retry.run(selected.id)} /> : null}
        </Sheet>
      ) : null}
    </Page>
  );
}
