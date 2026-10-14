import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getGenericErrorMessage, getStatus } from '../../api/problemDetails';
import { getTelegramStatus, issueTelegramBindToken, sendTelegramTest, unbindTelegram } from '../../api/telegram';
import type { TelegramBindTokenDto } from '../../api/telegram';
import { useToast } from '../../shared/overlays';
import { Badge, StatusDot } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { TELEGRAM_STATUS_QUERY_KEY } from './profilePresentation';

const POLL_INTERVAL_MS = 3000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Привязка Telegram. Пока ждём, что человек нажмёт Start у бота, статус опрашивается раз в 3 с —
 * страница сама увидит подключение. Код можно скопировать и отправить боту вручную (`/start КОД`).
 */
export function ProfileTelegramCard(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingBind, setPendingBind] = useState<TelegramBindTokenDto | null>(null);
  const [busy, setBusy] = useState<'issue' | 'test' | 'unbind' | 'check' | null>(null);

  const statusQuery = useQuery({
    queryKey: TELEGRAM_STATUS_QUERY_KEY,
    queryFn: getTelegramStatus,
    retry: false,
    refetchInterval: pendingBind !== null ? POLL_INTERVAL_MS : false,
  });

  const featureDisabled = statusQuery.error !== null && getStatus(statusQuery.error) === 404;
  const isBound = statusQuery.data?.isBound === true;

  useEffect(() => {
    if (isBound && pendingBind !== null) {
      setPendingBind(null);
      toast.success('Telegram подключён');
    }
  }, [isBound, pendingBind, toast]);

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<void>): Promise<void> {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const connect = (): Promise<void> => run('issue', async () => { setPendingBind(await issueTelegramBindToken()); });
  const check = (): Promise<void> =>
    run('check', async () => {
      const result = await statusQuery.refetch();
      if (result.data?.isBound !== true) toast.info('Пока не видим подключения — нажмите Start у бота и проверьте ещё раз');
    });
  const test = (): Promise<void> =>
    run('test', async () => {
      const result = await sendTelegramTest();
      if (result.delivered) toast.success('Тестовое сообщение отправлено — проверьте Telegram');
      else toast.error(result.error ?? 'Telegram не принял сообщение');
    });
  const disconnect = (): Promise<void> =>
    run('unbind', async () => {
      await unbindTelegram();
      await queryClient.invalidateQueries({ queryKey: TELEGRAM_STATUS_QUERY_KEY });
      toast.success('Telegram отключён — уведомления снова идут на почту');
    });

  const copyCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`/start ${code}`);
      toast.success('Команда скопирована — вставьте её в чат с ботом');
    } catch {
      toast.error('Не удалось скопировать — выделите код вручную');
    }
  };

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-divider px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info-soft text-info">
            <Send className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[14.5px] font-semibold text-ink">Telegram</h2>
            <p className="text-[12px] text-ink-muted">Уведомления в мессенджер</p>
          </div>
        </div>
        {featureDisabled ? (
          <Badge tone="neutral">Выключен в системе</Badge>
        ) : isBound ? (
          <Badge tone="success"><StatusDot tone="success" />Подключён</Badge>
        ) : (
          <Badge tone="warning"><StatusDot tone="warning" />Не подключён</Badge>
        )}
      </div>

      <div className="space-y-3.5 px-5 py-4">
        {statusQuery.isPending ? (
          <div className="h-16 animate-pulse rounded-control bg-surface-muted" />
        ) : featureDisabled ? (
          <p className="text-[13px] text-ink-muted">Администратор ещё не включил Telegram-уведомления для организации.</p>
        ) : isBound ? (
          <>
            <p className="text-[13px] text-ink-secondary">
              Подключён{statusQuery.data?.boundAt ? ` ${formatDateTime(statusQuery.data.boundAt)}` : ''}. Уведомления приходят в чат с ботом.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" leadingIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />} disabled={busy !== null} onClick={() => { void test(); }}>
                Тестовое сообщение
              </Button>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => { void disconnect(); }} className="text-danger hover:bg-danger-soft">
                Отключить
              </Button>
            </div>
          </>
        ) : pendingBind !== null ? (
          <ol className="space-y-3 text-[13px] text-ink-secondary">
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">1</span>
              <span>
                Откройте бота и нажмите <b className="text-ink">Start</b>:{' '}
                <a href={pendingBind.deepLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  открыть Telegram <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">2</span>
              <span className="min-w-0 flex-1">
                Или отправьте боту команду с кодом:
                <span className="mt-1.5 flex items-center gap-2 rounded-control border border-line bg-surface-muted px-2.5 py-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">/start {pendingBind.token}</code>
                  <button type="button" onClick={() => { void copyCode(pendingBind.token); }} className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface hover:text-brand" aria-label="Скопировать команду">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
                <span className="mt-1 block text-[11.5px] text-ink-muted">Код действует до {new Date(pendingBind.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">3</span>
              <span className="flex-1">
                Страница увидит подключение сама — или проверьте вручную.
                <Button variant="secondary" size="sm" className="mt-2" leadingIcon={<RefreshCw className={`h-3.5 w-3.5 ${busy === 'check' ? 'animate-spin' : ''}`} aria-hidden="true" />} disabled={busy !== null} onClick={() => { void check(); }}>
                  Проверить подключение
                </Button>
              </span>
            </li>
          </ol>
        ) : (
          <>
            <p className="text-[13px] text-ink-secondary">Подключите бота, чтобы получать новые задания, напоминания и результаты проверки в Telegram.</p>
            <Button variant="primary" size="sm" leadingIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />} disabled={busy !== null} onClick={() => { void connect(); }}>
              Подключить Telegram
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
