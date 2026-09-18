import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react';

import { apiClient } from '../../api/client';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';

interface Notification { id: string; eventType: string; channel: string; status: string; attempts: number; createdAt: string; }
interface NotificationResult { items: Notification[]; totalCount: number; }

export function NotificationsPage(): JSX.Element {
  const query = useQuery({ queryKey: ['admin-notifications'], queryFn: async () => (await apiClient.get<NotificationResult>('/api/v1/admin/notifications', { params: { page: 1, pageSize: 100 } })).data });
  const items = query.data?.items ?? [];
  return <div className="space-y-6"><PreviewPageHeader title="Уведомления" subtitle="Реальная очередь доставки" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetricCard icon={<Bell className="h-5 w-5" />} label="Всего" value={String(query.data?.totalCount ?? 0)} /><PreviewMetricCard icon={<Clock3 className="h-5 w-5" />} label="В очереди" value={String(items.filter((item) => item.status === 'Pending').length)} /><PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" />} label="Отправлены" value={String(items.filter((item) => item.status === 'Sent').length)} /><PreviewMetricCard icon={<TriangleAlert className="h-5 w-5" />} label="Ошибки" value={String(items.filter((item) => item.status === 'DeadLetter').length)} tone="warning" /></div><Card padded={false}>{query.isPending ? <p className="p-10 text-center text-sm text-ink-muted">Загрузка уведомлений…</p> : query.error ? <div className="p-5"><ErrorState error={query.error} title="Не удалось загрузить уведомления" /></div> : items.length === 0 ? <p className="p-10 text-center text-sm text-ink-muted">Реальных уведомлений пока нет.</p> : <PreviewTable><PreviewTableHead><PreviewTh>Событие</PreviewTh><PreviewTh>Канал</PreviewTh><PreviewTh>Статус</PreviewTh><PreviewTh>Попытки</PreviewTh><PreviewTh>Создано</PreviewTh></PreviewTableHead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-divider"><PreviewTd>{item.eventType}</PreviewTd><PreviewTd>{item.channel}</PreviewTd><PreviewTd>{item.status}</PreviewTd><PreviewTd>{item.attempts}</PreviewTd><PreviewTd>{new Date(item.createdAt).toLocaleString('ru-RU')}</PreviewTd></tr>)}</tbody></PreviewTable>}</Card></div>;
}