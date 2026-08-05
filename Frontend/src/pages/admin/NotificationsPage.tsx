import { CheckCircle2, Clock3, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useSearchParams } from 'react-router-dom';

import { NotificationActionMenu } from '../../features/admin-notifications/NotificationActionMenu';
import { NotificationDetailsDrawer } from '../../features/admin-notifications/NotificationDetailsDrawer';
import { RetryNotificationDialog } from '../../features/admin-notifications/RetryNotificationDialog';
import type { PreviewNotificationDetails } from '../../features/admin-notifications/notificationPresentation';
import { retryNotificationPreview, useNotificationsPreview } from '../../features/admin-notifications/notificationPreviewStore';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewTabs } from '../../features/admin-preview/PreviewTabs';
import { NOTIFICATION_STATUS_LABEL, PREVIEW_DELIVERY_SUCCESS_PCT, PREVIEW_NOTIFICATION_SUMMARY, type PreviewNotificationStatus } from '../../mocks/ui-preview/notifications.preview';
import { useToast } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';

const STATUS_TONE: Record<PreviewNotificationStatus, BadgeTone> = {
  Pending: 'neutral',
  Processing: 'info',
  Sent: 'success',
  DeadLetter: 'warning',
};

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Все каналы' },
  { value: 'Email', label: 'Email' },
  { value: 'Telegram', label: 'Telegram' },
];
const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  { value: 'Главный офис', label: 'Главный офис' },
  { value: 'Филиал Худжанд', label: 'Филиал Худжанд' },
  { value: 'Филиал Бохтар', label: 'Филиал Бохтар' },
];

const TABS = [
  { key: 'all', label: 'Все' },
  { key: 'Pending', label: 'В очереди' },
  { key: 'Processing', label: 'Обрабатываются' },
  { key: 'Sent', label: 'Отправлены' },
  { key: 'DeadLetter', label: 'Dead Letter' },
];

/** /admin/notifications — этап 3: NotificationDetailsDrawer + RetryNotificationDialog поверх shared overlay system. */
export function NotificationsPage(): JSX.Element {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [branch, setBranch] = useState('all');
  const [retryTarget, setRetryTarget] = useState<PreviewNotificationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const notifications = useNotificationsPreview();

  const [searchParams, setSearchParams] = useSearchParams();
  const notificationId = searchParams.get('notificationId');
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (notificationId === null) return;
    rowRefs.current.get(notificationId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [notificationId]);

  function openNotification(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('notificationId', id);
    setSearchParams(next);
  }

  function closeNotification(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('notificationId');
    setSearchParams(next);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (tab !== 'all' && n.status !== tab) return false;
      if (query.length > 0 && !n.eventLabel.toLowerCase().includes(query) && !n.recipientName.toLowerCase().includes(query)) return false;
      if (channel !== 'all' && n.channel !== channel) return false;
      if (branch !== 'all' && n.branchName !== branch) return false;
      return true;
    });
  }, [notifications, tab, search, channel, branch]);

  const selected = notificationId !== null ? notifications.find((n) => n.id === notificationId) : undefined;

  async function handleRetry(): Promise<void> {
    if (retryTarget === null) return;
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => { window.setTimeout(resolve, 450); });
      retryNotificationPreview(retryTarget.id);
      toast.success('Уведомление поставлено в очередь на повторную отправку');
    } finally {
      setIsSubmitting(false);
    }
  }

  const donutData = [
    { name: 'Доставлено', value: PREVIEW_DELIVERY_SUCCESS_PCT, color: 'var(--success)' },
    { name: 'Остальное', value: 100 - PREVIEW_DELIVERY_SUCCESS_PCT, color: 'var(--divider)' },
  ];

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Уведомления" subtitle="Статус отправки Email и Telegram уведомлений" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} label="В очереди" value={String(PREVIEW_NOTIFICATION_SUMMARY.pending)} />
        <PreviewMetricCard icon={<Loader2 className="h-5 w-5" aria-hidden="true" />} label="Обрабатываются" value={String(PREVIEW_NOTIFICATION_SUMMARY.processing)} />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Отправлены" value={String(PREVIEW_NOTIFICATION_SUMMARY.sent)} />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          label="Ошибки доставки"
          value={String(PREVIEW_NOTIFICATION_SUMMARY.deadLetter)}
          tone={PREVIEW_NOTIFICATION_SUMMARY.deadLetter > 0 ? 'warning' : 'default'}
        />
        <Card padded={false} className="flex h-full items-center gap-3 p-4">
          <div className="relative h-14 w-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={18} outerRadius={27} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-bold tabular-nums text-ink">{PREVIEW_DELIVERY_SUCCESS_PCT}%</span>
            </div>
          </div>
          <div>
            <p className="text-[12.5px] leading-4 text-ink-muted">Success Rate</p>
            <p className="text-[12px] text-ink-muted">за последние 7 дней</p>
          </div>
        </Card>
      </div>

      <Card padded={false} className="min-w-0">
        <div className="px-5 pt-4 sm:px-6">
          <PreviewTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по событию или получателю…" value={search} onChange={setSearch} />
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
          <PreviewSelect label="Канал" value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} />
          <PreviewResetButton
            onClick={() => {
              setSearch('');
              setChannel('all');
              setBranch('all');
            }}
          />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh>Событие</PreviewTh>
            <PreviewTh className="w-[160px]">Получатель</PreviewTh>
            <PreviewTh className="w-[90px]">Канал</PreviewTh>
            <PreviewTh className="w-[150px]">Scope</PreviewTh>
            <PreviewTh className="w-[125px]">Статус</PreviewTh>
            <PreviewTh className="w-[75px]">Попытки</PreviewTh>
            <PreviewTh className="w-[125px]">Создано</PreviewTh>
            <PreviewTh className="w-11" />
          </PreviewTableHead>
          <tbody>
            {rows.slice(0, 16).map((n) => {
              const showNextRetry = (n.status === 'Pending' || n.status === 'DeadLetter') && n.nextRetryLabel !== null;
              return (
                <tr
                  key={n.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(n.id, node);
                    else rowRefs.current.delete(n.id);
                  }}
                  tabIndex={0}
                  onClick={() => { openNotification(n.id); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openNotification(n.id);
                    }
                  }}
                  className={`h-14 cursor-pointer border-b border-divider text-sm outline-none last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                    n.id === notificationId ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                  }`}
                >
                  <PreviewTd className="truncate font-medium text-ink" title={n.eventLabel}>
                    {n.eventLabel}
                  </PreviewTd>
                  <PreviewTd className="truncate">{n.recipientName}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <Badge tone={n.channel === 'Telegram' ? 'info' : 'neutral'}>{n.channel}</Badge>
                  </PreviewTd>
                  <PreviewTd className="truncate text-[12.5px]">{n.branchName}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <Badge tone={STATUS_TONE[n.status]}>{NOTIFICATION_STATUS_LABEL[n.status]}</Badge>
                  </PreviewTd>
                  <PreviewTd className="tabular-nums">{n.attempts}</PreviewTd>
                  <PreviewTd>
                    <PreviewCellStack primary={n.createdLabel} secondary={showNextRetry ? `Повтор: ${n.nextRetryLabel}` : undefined} />
                  </PreviewTd>
                  <PreviewTd className="text-right" onClick={(event) => { event.stopPropagation(); }}>
                    <NotificationActionMenu
                      notification={n}
                      context="row"
                      onOpenDetails={() => { openNotification(n.id); }}
                      onRetry={() => { setRetryTarget(n); }}
                      onCopyCorrelationId={() => { void navigator.clipboard.writeText(n.correlationId); }}
                    />
                  </PreviewTd>
                </tr>
              );
            })}
          </tbody>
        </PreviewTable>
      </Card>

      <NotificationDetailsDrawer
        notificationId={notificationId}
        notification={selected}
        onClose={closeNotification}
        onRetry={(target) => { setRetryTarget(target); }}
      />

      <RetryNotificationDialog
        notification={retryTarget}
        open={retryTarget !== null}
        onOpenChange={(next) => { if (!next) setRetryTarget(null); }}
        isSubmitting={isSubmitting}
        onConfirm={handleRetry}
      />
    </div>
  );
}
