import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Download, FileText } from 'lucide-react';
import { useState } from 'react';

import { CRM_REPORT_KEYS, downloadCrmReportPdf, getCrmReport, listCrmReports } from '../../api/admin/crm';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { Drawer, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmPeriodView } from './CrmGroupDrawer';
import { CrmReportSummary } from './CrmReportSummary';
import { CrmReportText } from './CrmReportText';
import { formatRange, periodTitle } from './crmPresentation';

const DATE_TIME = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = (iso: string): string => DATE_TIME.format(new Date(iso)).replace(/\.(?=\s|,|$)/, '');

/** Отчёт так, как его читает тимлид: сводка с динамикой, выводы ИИ и ментора, детали недели. */
export function CrmReportDrawer({ id, onClose }: { id: string | null; onClose: () => void }): JSX.Element {
  const report = useQuery({ queryKey: CRM_REPORT_KEYS.one(id ?? ''), queryFn: () => getCrmReport(id ?? ''), enabled: id !== null });
  const r = report.data;
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const download = async (): Promise<void> => {
    if (!r) return;
    setDownloading(true);
    try {
      await downloadCrmReportPdf(r.id, `Отчёт ${r.groupName} ${periodTitle(r.periodLabel)}.pdf`);
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Drawer
      open={id !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={r ? `${r.groupName} · ${periodTitle(r.periodLabel)}` : 'Отчёт'}
      description={r ? `${r.courseName} · ${formatRange(r.from, r.to)}` : undefined}
      size="xl"
    >
      {report.isPending ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => { void report.refetch(); }} />
      ) : r ? (
        <div className="space-y-8">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
            <span className="font-medium text-ink-secondary">{r.authorName}</span>
            <span className={`inline-flex items-center gap-1.5 font-medium ${r.status === 'Sent' ? 'text-success' : 'text-warning'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {r.status === 'Sent' && r.sentAt ? `отправлен ${when(r.sentAt)}` : 'черновик — правится в карточке группы'}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => { void download(); }}
              isLoading={downloading}
            >
              Скачать PDF
            </Button>
          </p>
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Успеваемость группы</h3>
            <CrmReportSummary period={r.period} previous={r.previousPeriod} />
          </section>
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Выводы и рекомендации</h3>
            {r.conclusions.trim().length > 0 ? <CrmReportText text={r.conclusions} /> : <p className="text-[13px] text-ink-muted">Выводов нет.</p>}
          </section>
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Детали недели: пропуски, опоздания, замечания</h3>
            <CrmPeriodView period={r.period} />
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

/**
 * Отчёты, которые человек может прочитать: ментор — свои, тимлид — отправленные отчёты своих менторов,
 * админ — отправленные отчёты филиала или всей организации.
 */
export function CrmReportsView({ initialOpenId = null, onClosed }: { initialOpenId?: string | null; onClosed?: () => void } = {}): JSX.Element {
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const reports = useQuery({ queryKey: CRM_REPORT_KEYS.list, queryFn: listCrmReports, staleTime: 30_000 });

  const empty = user?.role === 'Mentor'
    ? 'Откройте группу, выберите закончившуюся неделю и нажмите «Сформировать отчёт».'
    : 'Менторы ещё не отправили ни одного отчёта.';

  return (
    <Card padded={false}>
      {reports.isPending ? (
        <div className="space-y-2 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : reports.isError ? (
        <div className="p-5"><ErrorState error={reports.error} onRetry={() => { void reports.refetch(); }} /></div>
      ) : reports.data.length === 0 ? (
        <div className="p-5"><EmptyState icon={<FileText className="h-5 w-5" aria-hidden="true" />} title="Отчётов пока нет" description={empty} /></div>
      ) : (
        <ul className="divide-y divide-divider">
          {reports.data.map((r) => {
            const sent = r.status === 'Sent';
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { setOpenId(r.id); }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-surface-hover sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {r.groupName} <span className="font-normal text-ink-muted">· {periodTitle(r.periodLabel)}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {formatRange(r.from, r.to)} · {r.isMine ? 'ваш отчёт' : r.authorName}
                      {r.averageTotal !== null && r.averageTotal !== undefined ? ` · средний ${String(r.averageTotal)}` : ''}
                    </span>
                  </span>
                  <span className="hidden whitespace-nowrap text-[12.5px] font-semibold tabular-nums sm:block" title="80+ · 70–79 · ниже 70">
                    <span className="text-success">{r.passed}</span><span className="px-1 text-ink-muted">·</span>
                    <span className="text-warning">{r.support}</span><span className="px-1 text-ink-muted">·</span>
                    <span className="text-danger">{r.risk}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium ${sent ? 'text-success' : 'text-warning'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sent ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
                      {sent && r.sentAt ? `отправлен ${when(r.sentAt)}` : 'черновик'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <CrmReportDrawer id={openId} onClose={() => { setOpenId(null); onClosed?.(); }} />
    </Card>
  );
}
