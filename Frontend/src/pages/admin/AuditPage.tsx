import { useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldCheck, ShieldX } from 'lucide-react';

import { apiClient } from '../../api/client';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';

interface AuditEntry { id: string; occurredAt: string; actorType: string; action: string; entityType: string; result: string; }
interface AuditResult { items: AuditEntry[]; totalCount: number; }

export function AuditPage(): JSX.Element {
  const query = useQuery({ queryKey: ['admin-audit'], queryFn: async () => (await apiClient.get<AuditResult>('/api/v1/admin/audit-log', { params: { page: 1, pageSize: 100 } })).data });
  const items = query.data?.items ?? [];
  return <div className="space-y-6"><PreviewPageHeader title="Журнал аудита" subtitle="Реальные административные и системные действия" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetricCard icon={<ScrollText className="h-5 w-5" />} label="Событий" value={String(query.data?.totalCount ?? 0)} /><PreviewMetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Успешные" value={String(items.filter((item) => item.result === 'Success').length)} /><PreviewMetricCard icon={<ShieldX className="h-5 w-5" />} label="Отклонённые" value={String(items.filter((item) => item.result !== 'Success').length)} /></div><Card padded={false}>{query.isPending ? <p className="p-10 text-center text-sm text-ink-muted">Загрузка журнала…</p> : query.error ? <div className="p-5"><ErrorState error={query.error} title="Не удалось загрузить журнал" /></div> : items.length === 0 ? <p className="p-10 text-center text-sm text-ink-muted">Реальных событий пока нет.</p> : <PreviewTable><PreviewTableHead><PreviewTh>Время</PreviewTh><PreviewTh>Актор</PreviewTh><PreviewTh>Действие</PreviewTh><PreviewTh>Объект</PreviewTh><PreviewTh>Результат</PreviewTh></PreviewTableHead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-divider"><PreviewTd>{new Date(item.occurredAt).toLocaleString('ru-RU')}</PreviewTd><PreviewTd>{item.actorType}</PreviewTd><PreviewTd>{item.action}</PreviewTd><PreviewTd>{item.entityType}</PreviewTd><PreviewTd>{item.result}</PreviewTd></tr>)}</tbody></PreviewTable>}</Card></div>;
}