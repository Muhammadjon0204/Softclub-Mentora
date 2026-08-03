import { CheckCircle2, Clock3, Loader2, RotateCw, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewTabs } from '../../features/admin-preview/PreviewTabs';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import {
  NOTIFICATION_STATUS_LABEL,
  PREVIEW_DELIVERY_SUCCESS_PCT,
  PREVIEW_NOTIFICATIONS,
  PREVIEW_NOTIFICATION_SUMMARY,
  type PreviewNotificationStatus,
} from '../../mocks/ui-preview/notifications.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/Button';
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

/**
 * UI-прототип /admin/notifications — layout-полироль (раздел 8): высокая
 * постоянная правая карточка «Успешность доставки» удалена — теперь это
 * компактная 5-я KPI-карточка с mini-donut той же высоты, что и остальные.
 * Таблица на всю ширину, Filial+Category (где есть) — в Scope.
 */
export function NotificationsPage(): JSX.Element {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [branch, setBranch] = useState('all');
  const [toastMessage, showToast] = usePreviewToast();

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_NOTIFICATIONS.filter((n) => {
      if (tab !== 'all' && n.status !== tab) return false;
      if (query.length > 0 && !n.eventLabel.toLowerCase().includes(query) && !n.recipientName.toLowerCase().includes(query)) return false;
      if (channel !== 'all' && n.channel !== channel) return false;
      if (branch !== 'all' && n.branchName !== branch) return false;
      return true;
    });
  }, [tab, search, channel, branch]);

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
                <PreviewTr key={n.id}>
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
                    <PreviewCellStack
                      primary={n.createdLabel}
                      secondary={showNextRetry ? `Повтор: ${n.nextRetryLabel}` : undefined}
                    />
                  </PreviewTd>
                  <PreviewTd className="text-right">
                    {n.status === 'DeadLetter' ? (
                      <IconButton
                        label="Повторить отправку"
                        size="sm"
                        onClick={() => {
                          showToast('Функция будет подключена позже');
                        }}
                      >
                        <RotateCw className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    ) : null}
                  </PreviewTd>
                </PreviewTr>
              );
            })}
          </tbody>
        </PreviewTable>
      </Card>

      <PreviewToast message={toastMessage} />
    </div>
  );
}
