import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock3, Mail, RotateCw, SearchX, Send, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import { listNotifications, retryNotification } from '../../api/admin/notifications';
import { listUsers } from '../../api/admin/users';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { Tooltip, useToast } from '../../shared/overlays';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { StaggerContainer } from '../../shared/ui/motion';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const STATUS_LABEL: Record<string, string> = {
  Pending: 'В очереди',
  Processing: 'Обрабатывается',
  Sent: 'Отправлено',
  DeadLetter: 'Ошибка доставки',
};

/** `Backend/src/MentorTaskFlow.Domain/Notifications/NotificationEventTypes.cs` — все типы событий (19 из ТЗ + подтверждение отправки ментору). */
const EVENT_TYPE_LABEL: Record<string, string> = {
  AssignmentAssigned: 'Задание назначено',
  AssignmentSuggested: 'Предложено задание',
  AssignmentReassigned: 'Задание переназначено',
  SubmissionUploaded: 'Загружено решение',
  LateSubmissionUploaded: 'Загружено решение с опозданием',
  SubmissionReceipt: 'Подтверждение отправки ментору',
  ReviewApproved: 'Решение одобрено',
  ReviewNeedsRework: 'Решение отправлено на доработку',
  DeadlineReminder: 'Напоминание о дедлайне',
  AssignmentOverdue: 'Задание просрочено',
  AssignmentCancelled: 'Задание отменено',
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

function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABEL[eventType] ?? eventType;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Pending: 'neutral',
  Processing: 'info',
  Sent: 'success',
  DeadLetter: 'danger',
};

function NotificationStatusBadge({ status }: { status: string }): JSX.Element {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>;
}

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Все каналы' },
  { value: 'Telegram', label: 'Telegram' },
  { value: 'Email', label: 'Email' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'Sent', label: 'Отправлено' },
  { value: 'DeadLetter', label: 'Ошибка доставки' },
  { value: 'Pending', label: 'В очереди' },
  { value: 'Processing', label: 'Обрабатывается' },
];

function ChannelLabel({ channel }: { channel: string }): JSX.Element {
  const Icon = channel === 'Telegram' ? Send : Mail;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
      <Icon className={`h-3.5 w-3.5 ${channel === 'Telegram' ? 'text-info' : 'text-ink-muted'}`} aria-hidden="true" />
      {channel}
    </span>
  );
}

/** Очередь доставки (`/admin/notifications`): кому, что, каким каналом и дошло ли. */
export function NotificationsPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const organizationId = user?.organization.id ?? 'anonymous';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => listNotifications({ page: 1, pageSize: 100 }),
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'list', organizationId],
    queryFn: () => listUsers({ page: 1, pageSize: 100 }),
    enabled: user !== null,
  });
  const userById = useMemo(() => new Map((usersQuery.data?.items ?? []).map((u) => [u.id, u])), [usersQuery.data]);

  const allItems = query.data?.items ?? [];
  const countOf = (value: string): number => allItems.filter((item) => item.status === value).length;
  const needle = search.trim().toLowerCase();
  const filtered = allItems.filter((item) => {
    if (channel !== 'all' && item.channel !== channel) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (needle !== '') {
      const recipient = userById.get(item.userId);
      const haystack = `${recipient?.fullName ?? ''} ${recipient?.email ?? ''} ${eventTypeLabel(item.eventType)}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = channel !== 'all' || status !== 'all' || needle !== '';
  const toggleStatus = (value: string) => (): void => { setStatus(status === value ? 'all' : value); setPage(1); };
  const errors = countOf('DeadLetter');

  async function handleRetry(id: string): Promise<void> {
    setRetryingId(id);
    try {
      await retryNotification(id);
      toast.success('Уведомление поставлено в очередь на повторную отправку');
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Уведомления" subtitle="Кому и что отправлено в Telegram и на почту, и дошло ли" />

      <StaggerContainer className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PreviewMetricCard icon={<Bell />} label="Всего" value={String(query.data?.totalCount ?? 0)} />
        <PreviewMetricCard icon={<Clock3 />} label="В очереди" value={String(countOf('Pending'))} onClick={toggleStatus('Pending')} active={status === 'Pending'} />
        <PreviewMetricCard icon={<CheckCircle2 />} label="Отправлены" value={String(countOf('Sent'))} tone="success" onClick={toggleStatus('Sent')} active={status === 'Sent'} />
        <PreviewMetricCard
          icon={<TriangleAlert />}
          label="Ошибки доставки"
          value={String(errors)}
          hint={errors > 0 ? 'Нажмите, чтобы показать' : 'Всё доставлено'}
          tone={errors > 0 ? 'danger' : 'default'}
          onClick={toggleStatus('DeadLetter')}
          active={status === 'DeadLetter'}
        />
      </StaggerContainer>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по получателю или событию" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
          <PreviewSelect label="Канал" value={channel} onChange={(value) => { setChannel(value); setPage(1); }} options={CHANNEL_OPTIONS} width="sm" />
          <PreviewSelect label="Статус" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={STATUS_OPTIONS} width="md" />
          <PreviewResetButton disabled={!filtersActive} onClick={() => { setChannel('all'); setStatus('all'); setSearch(''); setPage(1); }} />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[26%]">Событие</PreviewTh>
            <PreviewTh className="w-[24%]">Получатель</PreviewTh>
            <PreviewTh className="w-[11%]">Канал</PreviewTh>
            <PreviewTh className="w-[15%]">Статус</PreviewTh>
            <PreviewTh className="w-[13%]">Создано</PreviewTh>
            <PreviewTh className="w-[11%]"><span className="sr-only">Действия</span></PreviewTh>
          </PreviewTableHead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="py-2">{Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} columns={6} />)}</td>
              </tr>
            ) : query.error !== null ? (
              <tr>
                <td colSpan={6} className="px-5 py-2 sm:px-6">
                  <ErrorState error={query.error} title="Не удалось загрузить уведомления" onRetry={() => { void query.refetch(); }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  {allItems.length === 0 ? (
                    <EmptyState icon={<Bell className="h-5 w-5" aria-hidden="true" />} title="Уведомлений пока нет" description="Здесь появится очередь писем и сообщений в Telegram, как только в системе произойдут события." />
                  ) : (
                    <EmptyState icon={<SearchX className="h-5 w-5" aria-hidden="true" />} title="Ничего не найдено" description="Попробуйте другой канал, статус или запрос." />
                  )}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const recipient = userById.get(item.userId);
                const created = new Date(item.createdAt);
                return (
                  <tr key={item.id} className="h-14 border-b border-divider text-sm transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                    <PreviewTd className="py-2.5">
                      <span className="block truncate font-medium text-ink">{eventTypeLabel(item.eventType)}</span>
                      {item.isSystemAlert ? <span className="block text-[11.5px] text-ink-muted">Системное оповещение</span> : null}
                    </PreviewTd>
                    <PreviewTd className="py-2.5">
                      {recipient !== undefined ? (
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={recipient.fullName} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-ink">{recipient.fullName}</span>
                            <span className="block truncate text-[11.5px] text-ink-muted">{recipient.email}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-disabled">Пользователь удалён или вне доступа</span>
                      )}
                    </PreviewTd>
                    <PreviewTd><ChannelLabel channel={item.channel} /></PreviewTd>
                    <PreviewTd>
                      {item.status === 'DeadLetter' && item.lastError !== null && item.lastError !== undefined ? (
                        <Tooltip content={`Причина: ${item.lastError}`}>
                          <span className="cursor-help"><NotificationStatusBadge status={item.status} /></span>
                        </Tooltip>
                      ) : (
                        <NotificationStatusBadge status={item.status} />
                      )}
                      {item.attempts > 1 ? <span className="mt-0.5 block text-[11px] text-ink-muted">попыток: {item.attempts}</span> : null}
                    </PreviewTd>
                    <PreviewTd className="whitespace-nowrap tabular-nums">
                      <span className="block text-[13px] text-ink">{created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      <span className="block text-[11.5px] text-ink-muted">{created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    </PreviewTd>
                    <PreviewTd className="text-right">
                      {item.status === 'DeadLetter' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          leadingIcon={<RotateCw className={`h-3.5 w-3.5 ${retryingId === item.id ? 'animate-spin' : ''}`} aria-hidden="true" />}
                          disabled={retryingId !== null}
                          onClick={() => { void handleRetry(item.id); }}
                        >
                          Повторить
                        </Button>
                      ) : null}
                    </PreviewTd>
                  </tr>
                );
              })
            )}
          </tbody>
        </PreviewTable>

        {filtered.length > 0 ? (
          <PreviewPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        ) : null}
      </Card>
    </div>
  );
}
