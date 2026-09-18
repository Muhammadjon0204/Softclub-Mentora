import { useDashboardQuery } from '../../features/admin-dashboard/useDashboardQuery';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { Badge } from '../../shared/ui/Badge';
import { Card, SectionCard } from '../../shared/ui/Card';

export function HealthPage(): JSX.Element {
  const query = useDashboardQuery();
  const health = query.data?.systemHealth;
  return <div className="space-y-6"><PreviewPageHeader title="Состояние системы" subtitle="Статус сервисов из реального API" /><Card><p className="text-sm font-semibold text-ink">{query.isPending ? 'Загрузка состояния…' : health?.services.every((service) => service.status === 'Operational') ? 'Все системы работают' : 'Есть сервисы с ограниченной доступностью'}</p></Card><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{health?.services.map((service) => <Card key={service.id}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-ink">{service.name}</h2><Badge tone={service.status === 'Operational' ? 'success' : 'warning'}>{service.status}</Badge></div><p className="mt-3 text-sm text-ink-muted">{service.message}</p><p className="mt-2 text-xs text-ink-disabled">{service.latencyMs} мс · {new Date(service.lastCheckedAt).toLocaleString('ru-RU')}</p></Card>)}</div><SectionCard title="Последние системные события" padded={false}>{health?.recentEvents.length ? <ul className="divide-y divide-divider">{health.recentEvents.map((event) => <li key={event.id} className="px-5 py-3 text-sm text-ink">{event.message}<span className="ml-2 text-xs text-ink-muted">{new Date(event.at).toLocaleString('ru-RU')}</span></li>)}</ul> : <p className="p-5 text-sm text-ink-muted">Реальных системных событий пока нет.</p>}</SectionCard></div>;
}