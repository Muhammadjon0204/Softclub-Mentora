import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Clock3, TriangleAlert } from 'lucide-react';

import { listAssignments } from '../../api/lead/assignments';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';

export function AssignmentsPage(): JSX.Element {
  const query = useQuery({ queryKey: ['admin-assignments'], queryFn: () => listAssignments({ page: 1, pageSize: 100 }) });
  const assignments = query.data?.items ?? [];
  const active = assignments.filter((item) => ['Assigned', 'Submitted', 'InReview', 'NeedsRework', 'Overdue'].includes(item.status));
  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Задания" subtitle="Реальные задания из API" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" />} label="Активные" value={String(active.length)} />
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" />} label="Ожидают проверки" value={String(assignments.filter((item) => item.status === 'InReview').length)} />
        <PreviewMetricCard icon={<TriangleAlert className="h-5 w-5" />} label="Просроченные" value={String(assignments.filter((item) => item.status === 'Overdue').length)} tone="warning" />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" />} label="Одобрены" value={String(assignments.filter((item) => item.status === 'Approved').length)} />
      </div>
      <Card padded={false}>
        {query.isPending ? <p className="px-5 py-10 text-center text-sm text-ink-muted">Загрузка заданий…</p> : query.error ? <div className="p-5"><ErrorState error={query.error} title="Не удалось загрузить задания" /></div> : assignments.length === 0 ? <p className="px-5 py-10 text-center text-sm text-ink-muted">Реальных заданий пока нет.</p> : (
          <PreviewTable><PreviewTableHead><PreviewTh>Задание</PreviewTh><PreviewTh>Статус</PreviewTh><PreviewTh>Филиал</PreviewTh><PreviewTh>Дедлайн</PreviewTh></PreviewTableHead><tbody>{assignments.map((item) => <tr key={item.id} className="border-b border-divider"><PreviewTd>{item.title}</PreviewTd><PreviewTd>{item.status}</PreviewTd><PreviewTd>{item.branch?.name ?? '—'}</PreviewTd><PreviewTd>{new Date(item.currentDueAt).toLocaleDateString('ru-RU')}</PreviewTd></tr>)}</tbody></PreviewTable>
        )}
      </Card>
    </div>
  );
}