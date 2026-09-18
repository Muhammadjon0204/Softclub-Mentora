import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateOrganization } from '../../api/admin/organization';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { DisconnectIntegrationDialog } from '../../features/admin-settings/DisconnectIntegrationDialog';
import type { IntegrationKind } from '../../features/admin-settings/DisconnectIntegrationDialog';
import { ResetSettingsDialog } from '../../features/admin-settings/ResetSettingsDialog';
import { organizationQueryKey, useOrganizationQuery } from '../../features/admin-settings/useOrganizationQuery';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTabs } from '../../features/admin-preview/PreviewTabs';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { UnsavedChangesDialog, useToast } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card, SectionCard } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';
import { FormField, FormInput, FormSelect, ReadOnlyField } from '../../shared/ui/FormField';

/** Организация/безопасность/уведомления/интеграции — Organization Admin domain (ADR-001 8.1, ORG-024). */
const ORG_ADMIN_TABS = [
  { key: 'organization', label: 'Организация' },
  { key: 'security', label: 'Безопасность' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'integrations', label: 'Интеграции' },
  { key: 'interface', label: 'Интерфейс' },
];
const BRANCH_ADMIN_TABS = [{ key: 'interface', label: 'Интерфейс' }];

function ReadOnlyRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-divider py-2.5 text-[13px] last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }): JSX.Element {
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
        onClick={() => { onChange(!checked); }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-muted'}`}
      >
        <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function TabActions({ isDirty, isSubmitting, onSave, onReset }: { isDirty: boolean; isSubmitting: boolean; onSave: () => void; onReset: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={onReset}>
        Сбросить
      </Button>
      <Button variant="primary" disabled={!isDirty} isLoading={isSubmitting} onClick={onSave}>
        Сохранить изменения
      </Button>
    </div>
  );
}

interface SettingsSnapshot {
  orgName: string;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  reminders: boolean;
  compactMode: boolean;
  sidebarDefault: string;
  uiLanguage: string;
}

/**
 * UI-прототип /admin/settings — этап 3: реальный save только для полей,
 * подтверждённых ТЗ (Organization.name — ORG-004). «Главный офис» показан
 * read-only (реальное изменение — IsHeadOffice на /admin/branches, ADR-001
 * не относит его к Settings); часовой пояс/контакты организации убраны —
 * OrganizationSettings в Release 1.0 не существует (ORG-024).
 */
export function SettingsPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const branchContext = useBranchContext();
  // Тот же единственный источник правды, что в UsersPage.tsx — `role === 'Admin' && adminScope
  // === 'Organization'`, а не только `adminScope`, иначе при расхождении вкладка «Организация»
  // могла бы отрисоваться для актора, для которого `BranchProvider` так и не запросил филиалы.
  const isOrgAdmin = branchContext.canOverrideBranch;
  const TABS = isOrgAdmin ? ORG_ADMIN_TABS : BRANCH_ADMIN_TABS;
  const organizationId = authUser?.organization.id ?? 'anonymous';
  const headOfficeName = branchContext.availableBranches.find((branch) => branch.isHeadOffice)?.name ?? null;

  const [tab, setTab] = useState(isOrgAdmin ? 'organization' : 'interface');
  const toast = useToast();
  const queryClient = useQueryClient();

  const orgQuery = useOrganizationQuery();
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const [orgConcurrencyToken, setOrgConcurrencyToken] = useState<string | null>(null);
  const [orgNameError, setOrgNameError] = useState<string | null>(null);

  // GET /organization приходит асинхронно (в отличие от прежнего синхронного
  // preview-store) — черновик и скрытый concurrencyToken заполняются один раз,
  // когда данные приходят, и больше не перезаписываются фоновым refetch поверх
  // того, что пользователь уже успел напечатать.
  const orgInitializedRef = useRef(false);
  useEffect(() => {
    if (orgQuery.data === undefined || orgInitializedRef.current) return;
    orgInitializedRef.current = true;
    setOrgNameDraft(orgQuery.data.name);
    setOrgConcurrencyToken(orgQuery.data.concurrencyToken);
    savedRef.current = { ...savedRef.current, orgName: orgQuery.data.name };
  }, [orgQuery.data]);

  const updateOrganizationMutation = useMutation({
    mutationFn: updateOrganization,
    onSuccess: (updated) => {
      queryClient.setQueryData(organizationQueryKey(organizationId), updated);
      setOrgConcurrencyToken(updated.concurrencyToken);
      setOrgNameDraft(updated.name);
    },
  });

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [reminders, setReminders] = useState(true);

  const [emailConnected, setEmailConnected] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(true);

  const [compactMode, setCompactMode] = useState(false);
  const [sidebarDefault, setSidebarDefault] = useState('expanded');
  const [uiLanguage, setUiLanguage] = useState('ru');

  // orgName стартует пустым и заполняется эффектом выше, когда придёт GET /organization.
  const savedRef = useRef<SettingsSnapshot>({ orgName: '', emailEnabled, telegramEnabled, reminders, compactMode, sidebarDefault, uiLanguage });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationKind | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const current: SettingsSnapshot = { orgName: orgNameDraft, emailEnabled, telegramEnabled, reminders, compactMode, sidebarDefault, uiLanguage };
  const isDirty = Object.keys(current).some((key) => current[key as keyof SettingsSnapshot] !== savedRef.current[key as keyof SettingsSnapshot]);

  function applySnapshot(snapshot: SettingsSnapshot): void {
    setOrgNameDraft(snapshot.orgName);
    setEmailEnabled(snapshot.emailEnabled);
    setTelegramEnabled(snapshot.telegramEnabled);
    setReminders(snapshot.reminders);
    setCompactMode(snapshot.compactMode);
    setSidebarDefault(snapshot.sidebarDefault);
    setUiLanguage(snapshot.uiLanguage);
    setOrgNameError(null);
  }

  function requestTabChange(nextTab: string): void {
    if (isDirty) {
      setPendingTab(nextTab);
      setUnsavedOpen(true);
      return;
    }
    setTab(nextTab);
  }

  async function handleSave(): Promise<void> {
    if (tab === 'organization') {
      const trimmed = orgNameDraft.trim();
      if (trimmed.length < 2 || trimmed.length > 200) {
        setOrgNameError('Название должно содержать от 2 до 200 символов');
        return;
      }
      if (orgConcurrencyToken === null) return; // данные ещё не загрузились — Save недоступен
      setOrgNameError(null);

      setIsSubmitting(true);
      try {
        const updated = await updateOrganizationMutation.mutateAsync({ name: trimmed, concurrencyToken: orgConcurrencyToken });
        savedRef.current = { ...current, orgName: updated.name };
        toast.success('Изменения сохранены');
      } catch (error) {
        // CONCURRENCY_CONFLICT и прочие ошибки — тот же toast.error + человекочитаемый
        // текст, что и в остальном приложении (см. `pages/lead/*`); при конфликте версий
        // подтягиваем свежие данные, чтобы следующая попытка сохранить уже не била в 409.
        toast.error(getGenericErrorMessage(error));
        void orgQuery.refetch();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Остальные вкладки (Уведомления/Интерфейс) — локальные preview-настройки,
    // вне скоупа реальной интеграции (Users/Categories/Notifications и т.д. не
    // подключены). Поведение не меняется — тот же имитационный save с задержкой.
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => { window.setTimeout(resolve, 350); });
      savedRef.current = { ...current };
      toast.success('Изменения сохранены');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleResetConfirmed(): void {
    applySnapshot(savedRef.current);
  }

  let content: ReactNode = null;
  if (tab === 'organization') {
    if (orgQuery.isPending) {
      content = (
        <SectionCard title="Профиль организации">
          <div aria-busy="true" aria-live="polite" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <span className="sr-only">Загрузка организации…</span>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-control bg-surface-muted" />
            ))}
          </div>
        </SectionCard>
      );
    } else if (orgQuery.data === undefined) {
      content = (
        <Card>
          <ErrorState error={orgQuery.error} title="Не удалось загрузить организацию" onRetry={() => { void orgQuery.refetch(); }} />
        </Card>
      );
    } else {
      content = (
        <div className="space-y-4">
          <SectionCard title="Профиль организации">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Название" htmlFor="settings-org-name" required error={orgNameError ?? undefined}>
                <FormInput id="settings-org-name" value={orgNameDraft} invalid={orgNameError !== null} onChange={(event) => { setOrgNameDraft(event.target.value); }} />
              </FormField>
              <ReadOnlyField label="Slug" value={orgQuery.data.slug} hint="Неизменяем после создания" />
              <ReadOnlyField label="Главный офис" value={headOfficeName ?? '—'} hint="Изменяется на странице «Филиалы»" />
            </div>
          </SectionCard>

          <TabActions isDirty={isDirty} isSubmitting={isSubmitting} onSave={() => { void handleSave(); }} onReset={() => { setResetOpen(true); }} />
        </div>
      );
    }
  } else if (tab === 'security') {
    content = (
      <SectionCard title="Безопасность" description="Значения политики безопасности — только для чтения на этом этапе">
        <ReadOnlyRow label="Длительность сессии" value="30 дней (refresh-токен)" />
        <ReadOnlyRow label="Время жизни access-токена" value="15 минут" />
        <ReadOnlyRow label="Блокировка аккаунта" value="5 неудачных попыток входа" />
        <ReadOnlyRow label="Политика паролей" value="Минимум 12 символов, заглавная буква, цифра" />
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
        <TabActions isDirty={isDirty} isSubmitting={isSubmitting} onSave={() => { void handleSave(); }} onReset={() => { setResetOpen(true); }} />
      </div>
    );
  } else if (tab === 'integrations') {
    content = (
      <SectionCard title="Интеграции" description="Текущие подключения">
        <IntegrationRow name="Email provider" detail="SMTP · настраивается при развёртывании" connected={emailConnected} onDisconnect={emailConnected ? () => { setDisconnectTarget('email'); } : undefined} />
        <IntegrationRow name="Telegram bot" detail="Настраивается при развёртывании" connected={telegramConnected} onDisconnect={telegramConnected ? () => { setDisconnectTarget('telegram'); } : undefined} />
        <IntegrationRow name="MinIO" detail="Хранилище файлов и вложений" connected />
        <IntegrationRow name="AI provider" detail="Для AI-резюме в разделе «Отчёты»" connected={false} />
      </SectionCard>
    );
  } else {
    content = (
      <div className="space-y-4">
        <SectionCard title="Интерфейс">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Язык интерфейса" htmlFor="settings-ui-language">
              <FormSelect
                id="settings-ui-language"
                value={uiLanguage}
                onValueChange={setUiLanguage}
                options={[
                  { value: 'ru', label: 'Русский' },
                  { value: 'tg', label: 'Тоҷикӣ' },
                ]}
              />
            </FormField>
            <FormField label="Sidebar по умолчанию" htmlFor="settings-sidebar">
              <FormSelect
                id="settings-sidebar"
                value={sidebarDefault}
                onValueChange={setSidebarDefault}
                options={[
                  { value: 'expanded', label: 'Развёрнут' },
                  { value: 'collapsed', label: 'Свёрнут' },
                ]}
              />
            </FormField>
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

        <TabActions isDirty={isDirty} isSubmitting={isSubmitting} onSave={() => { void handleSave(); }} onReset={() => { setResetOpen(true); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Настройки"
        subtitle={isOrgAdmin ? 'Параметры организации и административного интерфейса' : 'Параметры интерфейса'}
      />

      <Card padded={false}>
        {TABS.length > 1 ? (
          <div className="px-5 pt-4 sm:px-6">
            <PreviewTabs tabs={TABS} active={tab} onChange={requestTabChange} />
          </div>
        ) : null}
        <div className="p-5 sm:p-6">{content}</div>
      </Card>

      <ResetSettingsDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={handleResetConfirmed}
      />

      <UnsavedChangesDialog
        open={unsavedOpen}
        onStay={() => { setUnsavedOpen(false); }}
        onDiscard={() => {
          applySnapshot(savedRef.current);
          setUnsavedOpen(false);
          if (pendingTab !== null) setTab(pendingTab);
          setPendingTab(null);
        }}
      />

      <DisconnectIntegrationDialog
        integration={disconnectTarget}
        open={disconnectTarget !== null}
        onOpenChange={(next) => { if (!next) setDisconnectTarget(null); }}
        isSubmitting={isDisconnecting}
        onConfirm={async () => {
          setIsDisconnecting(true);
          try {
            await new Promise((resolve) => { window.setTimeout(resolve, 450); });
            if (disconnectTarget === 'email') setEmailConnected(false);
            if (disconnectTarget === 'telegram') setTelegramConnected(false);
            toast.warning(`Интеграция «${disconnectTarget === 'email' ? 'Email' : 'Telegram'}» отключена`);
          } finally {
            setIsDisconnecting(false);
          }
        }}
      />
    </div>
  );
}

function IntegrationRow({ name, detail, connected, onDisconnect }: { name: string; detail: string; connected: boolean; onDisconnect?: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-3 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{name}</p>
        <p className="text-[12px] text-ink-muted">{detail}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'Подключено' : 'Не настроено'}</Badge>
        {onDisconnect !== undefined ? (
          <Button variant="secondary" size="sm" onClick={onDisconnect}>
            Отключить
          </Button>
        ) : null}
      </div>
    </div>
  );
}
