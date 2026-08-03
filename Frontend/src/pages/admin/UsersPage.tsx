import { Plus, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewDrawer, PreviewField, PreviewFieldSelect, PreviewTextInput } from '../../features/admin-preview/PreviewDrawer';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import {
  PREVIEW_NEW_USERS_SERIES,
  PREVIEW_USERS,
  PREVIEW_USER_SUMMARY,
  ROLE_LABEL,
  STATUS_LABEL,
  type PreviewUserRole,
  type PreviewUserStatus,
} from '../../mocks/ui-preview/users.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { ChartCard } from '../../shared/ui/ChartCard';

const ROLE_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  { value: 'OrgAdmin', label: ROLE_LABEL.OrgAdmin },
  { value: 'BranchAdmin', label: ROLE_LABEL.BranchAdmin },
  { value: 'Lead', label: ROLE_LABEL.Lead },
  { value: 'Mentor', label: ROLE_LABEL.Mentor },
];
const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  { value: 'Главный офис', label: 'Главный офис' },
  { value: 'Филиал Худжанд', label: 'Филиал Худжанд' },
  { value: 'Филиал Бохтар', label: 'Филиал Бохтар' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'Active', label: STATUS_LABEL.Active },
  { value: 'Invited', label: STATUS_LABEL.Invited },
  { value: 'Locked', label: STATUS_LABEL.Locked },
  { value: 'Deactivated', label: STATUS_LABEL.Deactivated },
];

const STATUS_TONE: Record<PreviewUserStatus, BadgeTone> = {
  Active: 'success',
  Invited: 'info',
  Locked: 'warning',
  Deactivated: 'neutral',
};

const ROLE_TONE: Record<PreviewUserRole, BadgeTone> = {
  OrgAdmin: 'brand',
  BranchAdmin: 'brand',
  Lead: 'info',
  Mentor: 'neutral',
};

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

/**
 * UI-прототип /admin/users — layout-полироль (раздел 5): график больше не
 * постоянная правая колонка (растягивалась по высоте длинной таблицы), а
 * компактная полноширинная лента между KPI и таблицей. Филиал+Категория
 * смёржены в Scope, таблица одна на всю ширину.
 */
export function UsersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftRole, setDraftRole] = useState('Mentor');
  const [draftBranch, setDraftBranch] = useState('Главный офис');
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [toastMessage, showToast] = usePreviewToast();

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_USERS.filter((user) => {
      if (
        query.length > 0 &&
        !user.fullName.toLowerCase().includes(query) &&
        !user.email.toLowerCase().includes(query) &&
        !ROLE_LABEL[user.role].toLowerCase().includes(query)
      ) {
        return false;
      }
      if (role !== 'all' && user.role !== role) return false;
      if (branch !== 'all' && user.branchName !== branch) return false;
      if (status !== 'all' && user.status !== status) return false;
      return true;
    });
  }, [search, role, branch, status]);

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Пользователи"
        subtitle="Администраторы, руководители направлений и менторы"
        action={
          <Button
            variant="primary"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            Добавить пользователя
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Всего" value={String(PREVIEW_USER_SUMMARY.total)} />
        <PreviewMetricCard icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} label="Администраторы" value={String(PREVIEW_USER_SUMMARY.admins)} />
        <PreviewMetricCard icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} label="Руководители направлений" value={String(PREVIEW_USER_SUMMARY.leads)} />
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Менторы" value={String(PREVIEW_USER_SUMMARY.mentors)} />
      </div>

      <ChartCard title="Новые пользователи за 30 дней" minHeight={190}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={PREVIEW_NEW_USERS_SERIES} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <RechartsTooltip
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 13 }}
            />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по имени, email или роли…" value={search} onChange={setSearch} />
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
          <PreviewSelect label="Роль" value={role} onChange={setRole} options={ROLE_OPTIONS} />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <PreviewResetButton
            onClick={() => {
              setSearch('');
              setRole('all');
              setBranch('all');
              setStatus('all');
            }}
          />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh>Пользователь</PreviewTh>
            <PreviewTh className="w-[180px]">Роль</PreviewTh>
            <PreviewTh className="w-[160px]">Scope</PreviewTh>
            <PreviewTh className="w-[105px]">Статус</PreviewTh>
            <PreviewTh className="w-[130px]">Последний вход</PreviewTh>
            <PreviewTh className="w-11" />
          </PreviewTableHead>
          <tbody>
            {rows.slice(0, 14).map((user) => (
              <PreviewTr key={user.id}>
                <PreviewTd>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                      {initialsOf(user.fullName)}
                    </span>
                    <PreviewCellStack primary={user.fullName} secondary={user.email} tooltip={`${user.fullName} · ${user.email}`} />
                  </div>
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap">
                  <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                </PreviewTd>
                <PreviewTd>
                  <PreviewCellStack primary={user.branchName} secondary={user.categoryName ?? '—'} />
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap">
                  <Badge tone={STATUS_TONE[user.status]}>{STATUS_LABEL[user.status]}</Badge>
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap text-[13px]">{user.lastLoginLabel}</PreviewTd>
                <PreviewTd className="text-right">
                  <PreviewActionMenu
                    items={[
                      { label: 'Открыть профиль', onClick: () => { showToast('Функция будет подключена позже'); } },
                      { label: 'Сменить роль', onClick: () => { showToast('Функция будет подключена позже'); } },
                      { label: 'Деактивировать', destructive: true, onClick: () => { showToast('Функция будет подключена позже'); } },
                    ]}
                  />
                </PreviewTd>
              </PreviewTr>
            ))}
          </tbody>
        </PreviewTable>

        <div className="flex items-center justify-between border-t border-divider px-5 py-3.5 text-[13px] text-ink-muted sm:px-6">
          <span>
            Показано {Math.min(rows.length, 14)} из {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled>
              Назад
            </Button>
            <Button variant="secondary" size="sm" disabled>
              Далее
            </Button>
          </div>
        </div>
      </Card>

      <PreviewDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        title="Добавить пользователя"
        description="Это визуальный прототип формы — сохранение пока не подключено"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDrawerOpen(false); }}>
              Отмена
            </Button>
            <Button variant="primary" disabled title="Функция будет подключена позже">
              Создать
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <PreviewField label="Полное имя">
            <PreviewTextInput placeholder="Имя Фамилия" value={draftName} onChange={setDraftName} />
          </PreviewField>
          <PreviewField label="Email">
            <PreviewTextInput placeholder="name@softclub-academy.test" value={draftEmail} onChange={setDraftEmail} />
          </PreviewField>
          <PreviewField label="Роль">
            <PreviewFieldSelect
              value={draftRole}
              onChange={setDraftRole}
              options={[
                { value: 'BranchAdmin', label: ROLE_LABEL.BranchAdmin },
                { value: 'Lead', label: ROLE_LABEL.Lead },
                { value: 'Mentor', label: ROLE_LABEL.Mentor },
              ]}
            />
          </PreviewField>
          <PreviewField label="Филиал">
            <PreviewFieldSelect
              value={draftBranch}
              onChange={setDraftBranch}
              options={BRANCH_OPTIONS.filter((option) => option.value !== 'all')}
            />
          </PreviewField>
          <PreviewField label="Категория">
            <PreviewFieldSelect
              value="C#"
              onChange={() => {}}
              options={[
                { value: 'C#', label: 'C#' },
                { value: 'Frontend', label: 'Frontend' },
                { value: 'Python', label: 'Python' },
              ]}
            />
          </PreviewField>
        </div>
      </PreviewDrawer>

      <PreviewToast message={toastMessage} />
    </div>
  );
}
