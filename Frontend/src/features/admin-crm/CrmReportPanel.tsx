import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Send, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  CRM_REPORT_KEYS,
  createCrmReport,
  getCrmReportState,
  redraftCrmReport,
  refreshCrmReport,
  saveCrmReport,
  sendCrmReport,
  type CrmReportState,
} from '../../api/admin/crm';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { FormTextarea } from '../../shared/ui/FormField';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmReportText } from './CrmReportText';

const DATE_TIME = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function when(iso: string): string {
  return DATE_TIME.format(new Date(iso)).replace(/\.(?=\s|,|$)/, '');
}

/**
 * Отчёт за неделю внутри журнала группы. Ментор создаёт черновик (ИИ пишет выводы), правит текст и
 * отправляет тимлиду; после отправки отчёт только читается. Чужой черновик не показывается — только кто
 * его готовит.
 */
export function CrmReportPanel({ groupId, week }: { groupId: number; week: number }): JSX.Element | null {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = CRM_REPORT_KEYS.state(groupId, week);
  const state = useQuery({ queryKey: key, queryFn: () => getCrmReportState(groupId, week) });
  const report = state.data?.report ?? null;

  const [text, setText] = useState('');
  useEffect(() => { setText(report?.conclusions ?? ''); }, [report?.id, report?.updatedAt, report?.conclusions]);
  const dirty = report !== null && text !== report.conclusions;

  const act = (fn: () => Promise<CrmReportState>, success?: string) => ({
    mutationFn: fn,
    onSuccess: (next: CrmReportState) => {
      queryClient.setQueryData(key, next);
      void queryClient.invalidateQueries({ queryKey: CRM_REPORT_KEYS.list });
      if (next.aiError) toast.error(next.aiError);
      else if (success) toast.success(success);
    },
    onError: (error: unknown) => { toast.error(getGenericErrorMessage(error)); },
  });

  const create = useMutation(act(() => createCrmReport(groupId, week)));
  const save = useMutation(act(() => saveCrmReport(groupId, week, text), 'Сохранено'));
  const redraft = useMutation(act(() => redraftCrmReport(groupId, week)));
  const refresh = useMutation(act(() => refreshCrmReport(groupId, week), 'Цифры обновлены'));
  const send = useMutation(act(async () => {
    if (dirty) await saveCrmReport(groupId, week, text);
    return sendCrmReport(groupId, week);
  }, 'Отчёт отправлен тимлиду'));
  const busy = create.isPending || save.isPending || redraft.isPending || refresh.isPending || send.isPending;

  if (state.isPending) {
    return <Skeleton className="h-16" />;
  }

  if (state.isError) {
    return null;
  }

  const s = state.data;

  if (!report) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-control border border-dashed border-line px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-[13px]">
          {s.blocked ? (
            <p className="text-ink-secondary">{s.blocked}</p>
          ) : s.canCreate ? (
            <>
              <p className="font-medium text-ink">Отчёта за эту неделю ещё нет</p>
              <p className="text-[12.5px] text-ink-muted">
                {s.aiAvailable ? 'ИИ подготовит черновик выводов — вы его проверите и отправите тимлиду.' : 'ИИ не настроен — выводы нужно будет написать самому.'}
              </p>
            </>
          ) : (
            <p className="text-ink-muted">{s.cannotCreate ?? 'Отчёта за эту неделю нет.'}</p>
          )}
        </div>
        {s.canCreate ? (
          <Button
            size="sm"
            leadingIcon={s.aiAvailable ? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => { create.mutate(); }}
            isLoading={create.isPending}
          >
            Сформировать отчёт
          </Button>
        ) : null}
      </div>
    );
  }

  const sent = report.status === 'Sent';
  return (
    <div className="rounded-control border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider px-4 py-2.5 text-[12.5px]">
        <span className="font-semibold text-ink">Отчёт за неделю</span>
        <span className={`inline-flex items-center gap-1.5 font-medium ${sent ? 'text-success' : 'text-warning'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sent ? 'bg-success' : 'bg-warning'}`} aria-hidden="true" />
          {sent && report.sentAt ? `отправлен ${when(report.sentAt)}` : 'черновик'}
        </span>
        <span className="text-ink-muted">{report.isMine ? 'ваш' : report.authorName}</span>
        {report.aiModel ? <span className="ml-auto text-[11.5px] text-ink-muted">черновик выводов — ИИ</span> : null}
      </div>

      {report.dataChanged ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-divider bg-warning-soft px-4 py-2 text-[12.5px] text-warning">
          <span className="flex-1">После отчёта журнал в CRM изменился — цифры в отчёте старые.</span>
          {report.canEdit ? (
            <Button size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => { refresh.mutate(); }} isLoading={refresh.isPending} disabled={busy}>
              Обновить цифры
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="px-4 py-3">
        {report.canEdit ? (
          <>
            <FormTextarea
              value={text}
              onChange={(e) => { setText(e.target.value); }}
              rows={10}
              placeholder="Выводы по неделе: общая картина, кто в зоне риска и почему, что делать дальше."
              aria-label="Выводы отчёта"
              className="font-[inherit] leading-6"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                leadingIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => {
                  if (window.confirm('Отправить отчёт тимлиду? После отправки его нельзя будет изменить.')) send.mutate();
                }}
                isLoading={send.isPending}
                disabled={busy || text.trim().length === 0}
              >
                Отправить тимлиду
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { save.mutate(); }} isLoading={save.isPending} disabled={busy || !dirty}>
                Сохранить
              </Button>
              {s.aiAvailable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => {
                    if (text.trim().length === 0 || window.confirm('ИИ напишет выводы заново — текущий текст будет заменён.')) redraft.mutate();
                  }}
                  isLoading={redraft.isPending}
                  disabled={busy}
                >
                  {text.trim().length === 0 ? 'Написать с ИИ' : 'Переписать с ИИ'}
                </Button>
              ) : null}
              {dirty ? <span className="text-[12px] text-ink-muted">есть несохранённые правки</span> : null}
            </div>
          </>
        ) : report.conclusions.trim().length > 0 ? (
          <CrmReportText text={report.conclusions} />
        ) : (
          <p className="text-[13px] text-ink-muted">Выводов нет.</p>
        )}
      </div>
    </div>
  );
}
