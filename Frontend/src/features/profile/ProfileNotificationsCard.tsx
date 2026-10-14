import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, ClipboardList, Mail, Send, ShieldAlert } from 'lucide-react';
import type { ComponentType } from 'react';

import type { AuthUser } from '../../api/auth';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { getNotificationPreferences, updateNotificationPreferences } from '../../api/profile';
import type { NotificationPreferences, NotificationTopic } from '../../api/profile';
import { getTelegramStatus } from '../../api/telegram';
import { Tooltip, useToast } from '../../shared/overlays';
import { Card } from '../../shared/ui/Card';
import { Switch } from '../../shared/ui/Switch';
import { TELEGRAM_STATUS_QUERY_KEY } from './profilePresentation';

const PREFERENCES_QUERY_KEY = ['auth', 'notification-preferences'] as const;

interface TopicRow {
  topic: NotificationTopic;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const ROWS: TopicRow[] = [
  { topic: 'assignments', icon: ClipboardList, title: 'Новые задания и назначения', description: 'Назначено, предложено расписанием, переназначено или отменено' },
  { topic: 'deadlines', icon: CalendarClock, title: 'Напоминания о дедлайнах', description: 'Перед сроком сдачи и когда срок истёк' },
  { topic: 'reviews', icon: BellRing, title: 'Статус проверки решений', description: 'Решение сдано, одобрено или отправлено на доработку' },
  { topic: 'system', icon: ShieldAlert, title: 'Системные оповещения', description: 'Филиалы, направления без руководителя, сбои доставки' },
];

/**
 * Матрица «тема × канал». Каждый переключатель сохраняется сразу и действует на сервере: выключенный
 * канал не получает писем/сообщений этой темы. Приглашения и ссылки для пароля приходят всегда.
 */
export function ProfileNotificationsCard({ user }: { user: AuthUser }): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: PREFERENCES_QUERY_KEY, queryFn: getNotificationPreferences });
  const telegramQuery = useQuery({ queryKey: TELEGRAM_STATUS_QUERY_KEY, queryFn: getTelegramStatus, retry: false });
  const telegramBound = telegramQuery.data?.isBound === true;

  // Ментору системные оповещения не приходят вовсе — строку не показываем.
  const rows = user.role === 'Mentor' ? ROWS.filter((row) => row.topic !== 'system') : ROWS;

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(PREFERENCES_QUERY_KEY);
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, next);
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(PREFERENCES_QUERY_KEY, context.previous);
      toast.error(getGenericErrorMessage(error));
    },
    onSuccess: (saved) => { queryClient.setQueryData(PREFERENCES_QUERY_KEY, saved); },
  });

  const prefs = preferencesQuery.data;
  const toggle = (topic: NotificationTopic, channel: 'email' | 'telegram', value: boolean): void => {
    if (prefs === undefined) return;
    mutation.mutate({ ...prefs, [topic]: { ...prefs[topic], [channel]: value } });
  };

  return (
    <Card padded={false}>
      <div className="border-b border-divider px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">Настройки уведомлений</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">Что и куда присылать. Изменения сохраняются сразу.</p>
      </div>

      <div className="px-5 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-x-3 border-b border-divider py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          <span>Событие</span>
          <span className="flex items-center justify-center gap-1"><Mail className="h-3.5 w-3.5" aria-hidden="true" />Email</span>
          <span className="flex items-center justify-center gap-1"><Send className="h-3.5 w-3.5" aria-hidden="true" />TG</span>
        </div>

        {preferencesQuery.isPending ? (
          <div className="space-y-3 py-4">{rows.map((row) => <div key={row.topic} className="h-10 animate-pulse rounded-control bg-surface-muted" />)}</div>
        ) : prefs === undefined ? (
          <p className="py-5 text-[13px] text-ink-muted">Не удалось загрузить настройки.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {rows.map(({ topic, icon: Icon, title, description }) => (
              <li key={topic} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-x-3 py-3.5">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-secondary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-ink">{title}</span>
                    <span className="block text-[12px] text-ink-muted">{description}</span>
                  </span>
                </span>
                <span className="flex justify-center">
                  <Switch checked={prefs[topic].email} onChange={(value) => { toggle(topic, 'email', value); }} label={`${title}: Email`} />
                </span>
                <span className="flex justify-center">
                  {telegramBound ? (
                    <Switch checked={prefs[topic].telegram} onChange={(value) => { toggle(topic, 'telegram', value); }} label={`${title}: Telegram`} />
                  ) : (
                    <Tooltip content="Сначала подключите Telegram в карточке слева">
                      <span>
                        <Switch checked={false} onChange={() => {}} label={`${title}: Telegram (не подключён)`} disabled />
                      </span>
                    </Tooltip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-divider px-5 py-3 text-[12px] text-ink-muted sm:px-6">
        Если выключить Telegram, а почту оставить — сообщение придёт на почту. Приглашения и ссылки для смены пароля приходят всегда.
      </p>
    </Card>
  );
}
