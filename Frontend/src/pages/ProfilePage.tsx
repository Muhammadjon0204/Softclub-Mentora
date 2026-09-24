import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getStatus, getGenericErrorMessage } from '../api/problemDetails';
import { getTelegramStatus, issueTelegramBindToken, unbindTelegram } from '../api/telegram';
import type { TelegramBindTokenDto } from '../api/telegram';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../shared/overlays';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';

const ROLE_LABEL: Record<string, string> = {
  Admin: 'Администратор',
  Lead: 'Руководитель направления',
  Mentor: 'Ментор',
};

const TELEGRAM_STATUS_QUERY_KEY = ['telegram-status'];
const POLL_INTERVAL_MS = 3000;

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Общий `/profile` для всех ролей (`FE-014`) — до этого маршрута не существовало,
 * пункт «Профиль» в ProfileMenu вёл в никуда. Пока единственное реальное
 * содержимое — привязка Telegram (TG-005..TG-014): у бэкенда уже полностью
 * готов bind-flow через deep link + webhook, фронта для него не было вовсе.
 */
export function ProfilePage(): JSX.Element | null {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [pendingBind, setPendingBind] = useState<TelegramBindTokenDto | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isUnbinding, setIsUnbinding] = useState(false);

  const statusQuery = useQuery({
    queryKey: TELEGRAM_STATUS_QUERY_KEY,
    queryFn: getTelegramStatus,
    retry: false,
    // Пока ждём, чтобы пользователь нажал Start в боте — коротко поллим статус,
    // чтобы страница сама увидела результат без ручного обновления.
    refetchInterval: pendingBind !== null ? POLL_INTERVAL_MS : false,
  });

  const featureDisabled = statusQuery.error !== null && getStatus(statusQuery.error) === 404;

  useEffect(() => {
    if (statusQuery.data?.isBound === true && pendingBind !== null) {
      setPendingBind(null);
      toast.success('Telegram успешно подключён');
    }
  }, [statusQuery.data?.isBound, pendingBind, toast]);

  if (user === null) return null;

  async function handleConnect(): Promise<void> {
    setIsIssuing(true);
    try {
      const token = await issueTelegramBindToken();
      setPendingBind(token);
      window.open(token.deepLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setIsIssuing(false);
    }
  }

  async function handleDisconnect(): Promise<void> {
    setIsUnbinding(true);
    try {
      await unbindTelegram();
      await queryClient.invalidateQueries({ queryKey: TELEGRAM_STATUS_QUERY_KEY });
      toast.success('Telegram отключён — уведомления снова идут на почту');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    } finally {
      setIsUnbinding(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-[28px] font-bold leading-9 tracking-tight text-ink">Профиль</h1>
        <p className="mt-1 text-sm text-ink-muted">Личные данные и настройки уведомлений</p>
      </div>

      <Card>
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[17px] font-semibold text-brand">
            {initialsOf(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-[13px] text-ink-muted">{user.email}</p>
          </div>
          <Badge tone="brand">{ROLE_LABEL[user.role] ?? user.role}</Badge>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Telegram-уведомления</h2>
            <p className="mt-1 text-[13px] leading-[19px] text-ink-muted">
              Новые задания, дедлайны и напоминания будут приходить в Telegram — в дополнение к письмам на почту.
            </p>
          </div>
          <Send className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
        </div>

        <div className="mt-4">
          {statusQuery.isPending ? (
            <p className="text-[13px] text-ink-muted">Проверка статуса…</p>
          ) : featureDisabled ? (
            <p className="rounded-control-sm border border-line bg-surface-muted px-3 py-2.5 text-[13px] text-ink-muted">
              Telegram-уведомления пока не включены в системе.
            </p>
          ) : statusQuery.data?.isBound === true ? (
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Подключено
              </span>
              <Button
                variant="secondary"
                size="sm"
                isLoading={isUnbinding}
                onClick={() => {
                  void handleDisconnect();
                }}
              >
                Отключить
              </Button>
            </div>
          ) : pendingBind !== null ? (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-muted">
                Откройте чат с ботом и нажмите «Start» — страница обновится сама, как только аккаунт привяжется.
              </p>
              <Button
                variant="secondary"
                size="sm"
                trailingIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => {
                  window.open(pendingBind.deepLink, '_blank', 'noopener,noreferrer');
                }}
              >
                Открыть Telegram
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              isLoading={isIssuing}
              onClick={() => {
                void handleConnect();
              }}
            >
              Подключить Telegram
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
