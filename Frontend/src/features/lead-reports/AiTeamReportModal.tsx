import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

import { generateAiSummary, type AiSummary, type AiSummaryRequest } from '../../api/aiSummary';
import { getGenericErrorMessage, getStatus } from '../../api/problemDetails';
import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Skeleton } from '../../shared/ui/Skeleton';
import { CrmReportText } from '../admin-crm/CrmReportText';

const DATE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function day(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return DATE.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)).replace(/\s*г\.$/, '');
}

function errorText(error: unknown): string {
  const status = getStatus(error);
  if (status === 404) return 'ИИ не включён на сервере — попросите администратора включить его.';
  if (status === 429) return 'Лимит ИИ на сегодня исчерпан или запросов слишком много подряд — попробуйте позже.';
  if (status === 503) return 'ИИ сейчас недоступен — попробуйте через пару минут.';
  return getGenericErrorMessage(error);
}

/**
 * «ИИ-отчёт команды»: настоящий ИИ (`POST /reports/ai-summary`) по тем же метрикам, что на странице, —
 * сильные и слабые стороны, динамика к прошлому периоду, рекомендации. Ответ кэшируется на сервере:
 * повторное открытие за тот же период приходит мгновенно.
 */
export function AiTeamReportModal({ open, onOpenChange, request, title }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AiSummaryRequest;
  title: string;
}): JSX.Element {
  const generate = useMutation({ mutationFn: (force: boolean) => generateAiSummary({ ...request, force }) });
  const key = JSON.stringify(request);

  useEffect(() => {
    if (open) generate.mutate(false);
    // Новый запрос — только при открытии или смене фильтров.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const data: AiSummary | undefined = generate.data;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} size="lg" icon={<Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />}>
      {generate.isPending ? (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">ИИ анализирует метрики команды — обычно это 10–40 секунд…</p>
          <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-24" />
        </div>
      ) : generate.isError ? (
        <div className="space-y-3">
          <p className="rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning">{errorText(generate.error)}</p>
          <Button size="sm" variant="secondary" onClick={() => { generate.mutate(false); }}>Повторить</Button>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
            <span>Период: {day(data.from)} — {day(data.to)}{data.isPartialPeriod ? ' (неполный)' : ''}</span>
            <span>{data.fromCache ? 'из сохранённых' : 'только что'} · {TIME.format(new Date(data.generatedAt))}</span>
          </p>
          <CrmReportText text={data.content} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-3">
            <p className="max-w-[48ch] text-[11.5px] text-ink-muted">{data.disclaimer}</p>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => { generate.mutate(true); }}
            >
              Сгенерировать заново
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
