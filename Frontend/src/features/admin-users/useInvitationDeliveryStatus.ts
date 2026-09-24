import { useQuery } from '@tanstack/react-query';

import { listNotifications } from '../../api/admin/notifications';
import type { PreviewUserStatus } from '../../mocks/ui-preview/users.preview';

/** Статусы `notification_outbox`, при которых письмо ещё не ушло получателю. */
const UNDELIVERED_STATUSES = new Set(['Pending', 'Processing', 'DeadLetter']);

/**
 * Последний статус письма-приглашения по каждому пользователю — `userId -> status`.
 * Сервер отдаёт строки, отсортированные по `CreatedAt desc`, поэтому первое
 * вхождение `userId` в ответе уже и есть последняя попытка (баг-репорт 2026-09-24:
 * `status='Invited'` сам по себе не отличает «письмо реально ушло, ждём» от
 * «письмо застряло в очереди/не доставлено» — для этого нужен именно outbox).
 */
export function useInvitationDeliveryMap(): { map: Map<string, string>; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['admin-notifications', 'UserInvitation'],
    queryFn: async () => listNotifications({ eventType: 'UserInvitation', pageSize: 100 }),
  });

  const map = new Map<string, string>();
  for (const item of query.data?.items ?? []) {
    if (!map.has(item.userId)) map.set(item.userId, item.status);
  }
  return { map, isLoading: query.isPending };
}

/**
 * `true`, если пользователю ещё не выставлен пароль И его письмо-приглашение
 * не подтверждено доставленным (в очереди/повторяется/окончательно не ушло, либо
 * данных о нём вовсе нет). Такие пользователи не должны предлагаться в списках
 * назначения ролей — иначе выбирается человек, который физически не может
 * настроить аккаунт (раздел ответа на баг-репорт: "те кому отправили, но письмо
 * не дошло, должны отсюда исчезнуть").
 */
export function isInvitationUndelivered(
  user: { id: string; status: PreviewUserStatus },
  deliveryMap: Map<string, string>,
): boolean {
  if (user.status !== 'Invited') return false;
  const status = deliveryMap.get(user.id);
  return status === undefined || UNDELIVERED_STATUSES.has(status);
}
