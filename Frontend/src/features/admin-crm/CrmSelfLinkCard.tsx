import { CheckCircle2, Link2, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { CrmAccess } from '../../api/admin/crm';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex gap-3">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${done ? 'bg-success-soft text-success' : 'bg-brand/10 text-brand'}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : n}
      </span>
      <div className="min-w-0 flex-1 text-[13.5px] text-ink-secondary">{children}</div>
    </li>
  );
}

/**
 * Как ментору или тимлиду самому связать аккаунт с CRM: подключить Telegram и поделиться в боте
 * номером, с которым входишь в CRM. Номер подтверждает сам Telegram — ввести чужой нельзя.
 */
export function CrmSelfLinkCard({ access, onCheck, checking, compact = false }: {
  access: CrmAccess;
  onCheck: () => void;
  checking: boolean;
  compact?: boolean;
}): JSX.Element {
  const { user } = useAuth();
  const profilePath = user?.role === 'Lead' ? '/lead/profile' : '/mentor/profile';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand/10 text-brand">
          <Link2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">{compact ? 'Свяжите и свой аккаунт с CRM' : 'Свяжите аккаунт с CRM'}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {compact
              ? 'Тогда здесь появятся и группы, которые ведёте вы сами.'
              : 'Тогда здесь появятся ваши группы, студенты и журнал из CRM. Это займёт минуту.'}
          </p>
          <ol className="mt-4 space-y-3">
            <Step n={1} done={access.telegramBound}>
              {access.telegramBound
                ? 'Telegram подключён.'
                : <>Подключите Telegram в <Link to={profilePath} className="font-medium text-brand hover:underline">профиле</Link> — кнопка «Подключить Telegram».</>}
            </Step>
            <Step n={2}>
              Откройте бота, отправьте <b className="text-ink">/crm</b> и нажмите «Поделиться номером». Номер должен быть тем же,
              с которым вы входите в CRM.
            </Step>
            <Step n={3}>Вернитесь сюда и нажмите «Проверить».</Step>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {access.botUrl ? (
              <Button
                size="sm"
                leadingIcon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => { window.open(access.botUrl ?? '', '_blank', 'noopener,noreferrer'); }}
              >
                Открыть бота
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onCheck} isLoading={checking}>
              Проверить
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">Если в CRM у вас другой номер — попросите администратора организации связать аккаунт вручную.</p>
        </div>
      </div>
    </Card>
  );
}
