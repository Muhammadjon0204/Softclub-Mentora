import { useState } from 'react';
import type { ReactNode } from 'react';

import { PreviewField, PreviewFieldSelect, PreviewTextInput } from '../../features/admin-preview/PreviewDrawer';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTabs } from '../../features/admin-preview/PreviewTabs';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card, SectionCard } from '../../shared/ui/Card';

const TABS = [
  { key: 'organization', label: 'Организация' },
  { key: 'security', label: 'Безопасность' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'integrations', label: 'Интеграции' },
  { key: 'interface', label: 'Интерфейс' },
];

function ReadOnlyRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-divider py-2.5 text-[13px] last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-divider py-3 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="text-[12px] text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => {
          onChange(!checked);
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-muted'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function TabActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="secondary" onClick={onCancel}>
        Отменить
      </Button>
      <Button variant="primary" onClick={onSave}>
        Сохранить изменения
      </Button>
    </div>
  );
}

/** UI-прототип /admin/settings — кнопки визуальные, сохранение не подключено (раздел 14 сессии превью). */
export function SettingsPage(): JSX.Element {
  const [tab, setTab] = useState('organization');
  const [toastMessage, showToast] = usePreviewToast();

  const [orgName, setOrgName] = useState('SoftClub IT Academy');
  const [orgSlug, setOrgSlug] = useState('softclub-academy');
  const [mainOffice, setMainOffice] = useState('branch-hq');
  const [timezone, setTimezone] = useState('Asia/Dushanbe');
  const [dateFormat, setDateFormat] = useState('dd.MM.yyyy');
  const [language, setLanguage] = useState('ru');
  const [contactEmail, setContactEmail] = useState('office@softclub-academy.test');
  const [contactPhone, setContactPhone] = useState('+992 37 221 00 00');
  const [contactAddress, setContactAddress] = useState('г. Душанбе, ул. Рудаки, 22');

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [reminders, setReminders] = useState(true);

  const [compactMode, setCompactMode] = useState(false);
  const [sidebarDefault, setSidebarDefault] = useState('expanded');
  const [uiLanguage, setUiLanguage] = useState('ru');

  const handleSave = (): void => {
    showToast('Функция будет подключена позже');
  };

  let content: ReactNode = null;
  if (tab === 'organization') {
    content = (
      <div className="space-y-4">
        <SectionCard title="Профиль организации">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PreviewField label="Название">
              <PreviewTextInput placeholder="Название организации" value={orgName} onChange={setOrgName} />
            </PreviewField>
            <PreviewField label="Slug">
              <PreviewTextInput placeholder="slug" value={orgSlug} onChange={setOrgSlug} />
            </PreviewField>
            <PreviewField label="Главный офис">
              <PreviewFieldSelect
                value={mainOffice}
                onChange={setMainOffice}
                options={[
                  { value: 'branch-hq', label: 'Главный офис' },
                  { value: 'branch-khu', label: 'Филиал Худжанд' },
                  { value: 'branch-bok', label: 'Филиал Бохтар' },
                ]}
              />
            </PreviewField>
            <PreviewField label="Часовой пояс по умолчанию">
              <PreviewFieldSelect
                value={timezone}
                onChange={setTimezone}
                options={[{ value: 'Asia/Dushanbe', label: 'Asia/Dushanbe (UTC+5)' }]}
              />
            </PreviewField>
          </div>
        </SectionCard>

        <SectionCard title="Региональные настройки">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PreviewField label="Часовой пояс">
              <PreviewFieldSelect value={timezone} onChange={setTimezone} options={[{ value: 'Asia/Dushanbe', label: 'Asia/Dushanbe' }]} />
            </PreviewField>
            <PreviewField label="Формат даты">
              <PreviewFieldSelect
                value={dateFormat}
                onChange={setDateFormat}
                options={[
                  { value: 'dd.MM.yyyy', label: '31.12.2026' },
                  { value: 'yyyy-MM-dd', label: '2026-12-31' },
                ]}
              />
            </PreviewField>
            <PreviewField label="Язык">
              <PreviewFieldSelect value={language} onChange={setLanguage} options={[{ value: 'ru', label: 'Русский' }, { value: 'tg', label: 'Тоҷикӣ' }]} />
            </PreviewField>
          </div>
        </SectionCard>

        <SectionCard title="Контакты">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PreviewField label="Email">
              <PreviewTextInput placeholder="office@example.com" value={contactEmail} onChange={setContactEmail} />
            </PreviewField>
            <PreviewField label="Телефон">
              <PreviewTextInput placeholder="+992 ..." value={contactPhone} onChange={setContactPhone} />
            </PreviewField>
            <div className="sm:col-span-2">
              <PreviewField label="Адрес">
                <PreviewTextInput placeholder="Адрес главного офиса" value={contactAddress} onChange={setContactAddress} />
              </PreviewField>
            </div>
          </div>
        </SectionCard>

        <TabActions onSave={handleSave} onCancel={handleSave} />
      </div>
    );
  } else if (tab === 'security') {
    content = (
      <SectionCard title="Безопасность" description="Значения политики безопасности — только для чтения на этом этапе">
        <ReadOnlyRow label="Длительность сессии" value="30 дней (refresh-токен)" />
        <ReadOnlyRow label="Время жизни access-токена" value="15 минут" />
        <ReadOnlyRow label="Блокировка аккаунта" value="5 неудачных попыток входа" />
        <ReadOnlyRow label="Политика паролей" value="Минимум 8 символов, запрет топ-10000 паролей" />
      </SectionCard>
    );
  } else if (tab === 'notifications') {
    content = (
      <div className="space-y-4">
        <SectionCard title="Каналы уведомлений">
          <ToggleRow label="Email" description="Отправлять уведомления по электронной почте" checked={emailEnabled} onChange={setEmailEnabled} />
          <ToggleRow label="Telegram" description="Отправлять уведомления через Telegram-бота" checked={telegramEnabled} onChange={setTelegramEnabled} />
          <ToggleRow label="Напоминания о дедлайнах" description="Напоминать ментору за 24 часа до дедлайна" checked={reminders} onChange={setReminders} />
        </SectionCard>
        <TabActions onSave={handleSave} onCancel={handleSave} />
      </div>
    );
  } else if (tab === 'integrations') {
    content = (
      <SectionCard title="Интеграции" description="Текущие подключения — управление появится на следующем этапе">
        <IntegrationRow name="Email provider" detail="SMTP · mail.softclub-academy.test" connected />
        <IntegrationRow name="Telegram bot" detail="@mentora_notify_bot" connected />
        <IntegrationRow name="MinIO" detail="Хранилище файлов и вложений" connected />
        <IntegrationRow name="AI provider" detail="Для AI-резюме в разделе «Отчёты»" connected={false} />
      </SectionCard>
    );
  } else {
    content = (
      <div className="space-y-4">
        <SectionCard title="Интерфейс">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PreviewField label="Язык интерфейса">
              <PreviewFieldSelect value={uiLanguage} onChange={setUiLanguage} options={[{ value: 'ru', label: 'Русский' }, { value: 'tg', label: 'Тоҷикӣ' }]} />
            </PreviewField>
            <PreviewField label="Sidebar по умолчанию">
              <PreviewFieldSelect
                value={sidebarDefault}
                onChange={setSidebarDefault}
                options={[
                  { value: 'expanded', label: 'Развёрнут' },
                  { value: 'collapsed', label: 'Свёрнут' },
                ]}
              />
            </PreviewField>
          </div>
          <div className="mt-1">
            <ToggleRow label="Компактный режим" description="Плотнее строки таблиц и меньше отступы карточек" checked={compactMode} onChange={setCompactMode} />
          </div>
        </SectionCard>

        <SectionCard title="Тема">
          <div className="flex flex-wrap gap-3">
            <div className="w-40 rounded-control border-2 border-brand p-2.5">
              <div className="h-16 rounded-control-sm bg-app" />
              <p className="mt-1.5 text-center text-[12px] font-medium text-ink">Светлая</p>
            </div>
            <div className="w-40 rounded-control border border-line p-2.5 opacity-60">
              <div className="h-16 rounded-control-sm bg-ink" />
              <p className="mt-1.5 text-center text-[12px] font-medium text-ink-muted">Тёмная (скоро)</p>
            </div>
          </div>
        </SectionCard>

        <TabActions onSave={handleSave} onCancel={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Настройки" subtitle="Параметры организации и административного интерфейса" />

      <Card padded={false}>
        <div className="px-5 pt-4 sm:px-6">
          <PreviewTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <div className="p-5 sm:p-6">{content}</div>
      </Card>

      <PreviewToast message={toastMessage} />
    </div>
  );
}

function IntegrationRow({ name, detail, connected }: { name: string; detail: string; connected: boolean }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-divider py-3 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{name}</p>
        <p className="text-[12px] text-ink-muted">{detail}</p>
      </div>
      <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'Подключено' : 'Не настроено'}</Badge>
    </div>
  );
}
