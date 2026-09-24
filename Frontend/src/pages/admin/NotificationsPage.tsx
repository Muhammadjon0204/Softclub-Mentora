import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { listNotifications } from '../../api/admin/notifications';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const STATUS_LABEL: Record<string, string> = {
  Pending: 'В очереди',
  Processing: 'Обрабатывается',
  Sent: 'Отправлено',
  DeadLetter: 'Ошибка доставки',
};

/** `Backend/src/MentorTaskFlow.Domain/Notifications/NotificationEventTypes.cs` — все 19 типов события. */
const EVENT_TYPE_LABEL: Record<string, string> = {
  AssignmentAssigned: 'Задание назначено',
  AssignmentSuggested: 'Предложено задание',
  AssignmentReassigned: 'Задание переназначено',
  SubmissionUploaded: 'Загружено решение',
  LateSubmissionUploaded: 'Загружено решение с опозданием',
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

/** Реальная очередь доставки (`/admin/notifications`) — не preview. */
export function NotificationsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const query = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => listNotifications({ page: 1, pageSize: 100 }),
  });

  const allItems = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = allItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Уведомления" subtitle="Реальная очередь доставки" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Bell className="h-5 w-5" />} label="Всего" value={String(query.data?.totalCount ?? 0)} />
        <PreviewMetricCard
          icon={<Clock3 className="h-5 w-5" />}
          label="В очереди"
          value={String(allItems.filter((item) => item.status === 'Pending').length)}
        />
        <PreviewMetricCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Отправлены"
          value={String(allItems.filter((item) => item.status === 'Sent').length)}
        />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" />}
          label="Ошибки"
          value={String(allItems.filter((item) => item.status === 'DeadLetter').length)}
          tone="warning"
        />
      </div>

      <Card padded={false} className="min-w-0">
        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[32%]">Событие</PreviewTh>
            <PreviewTh className="w-[12%]">Канал</PreviewTh>
            <PreviewTh className="w-[18%]">Статус</PreviewTh>
            <PreviewTh className="w-[10%]">Попытки</PreviewTh>
            <PreviewTh className="w-[28%]">Создано</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-ink-muted sm:px-6">
                  Загрузка уведомлений…
                </td>
              </tr>
            ) : query.error !== null ? (
              <tr>
                <td colSpan={5} className="px-5 py-2 sm:px-6">
                  <ErrorState error={query.error} title="Не удалось загрузить уведомления" onRetry={() => { void query.refetch(); }} />
                </td>
              </tr>
            ) : allItems.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<Bell className="h-5 w-5" aria-hidden="true" />}
                    title="Уведомлений пока нет"
                    description="Здесь появится очередь писем и системных оповещений, как только в системе произойдут события."
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((item) => (
                <tr key={item.id} className="h-14 border-b border-divider text-sm transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                  <PreviewTd className="font-medium text-ink">{eventTypeLabel(item.eventType)}</PreviewTd>
                  <PreviewTd>{item.channel}</PreviewTd>
                  <PreviewTd>
                    <NotificationStatusBadge status={item.status} />
                  </PreviewTd>
                  <PreviewTd className="tabular-nums">{item.attempts}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap tabular-nums">{new Date(item.createdAt).toLocaleString('ru-RU')}</PreviewTd>
                </tr>
              ))
            )}
          </tbody>
        </PreviewTable>

        {allItems.length > 0 ? (
          <PreviewPagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={allItems.length}
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
