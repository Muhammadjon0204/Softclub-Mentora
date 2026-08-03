import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users as UsersIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { useSearchParams } from 'react-router-dom';

import { PreviewDrawer, PreviewField, PreviewFieldSelect, PreviewTextInput } from '../../features/admin-preview/PreviewDrawer';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import {
  PREVIEW_NEW_USERS_SERIES,
  PREVIEW_USERS,
  PREVIEW_USER_SUMMARY,
  ROLE_LABEL,
  STATUS_LABEL,
  type PreviewUser,
  type PreviewUserRole,
  type PreviewUserStatus,
} from '../../mocks/ui-preview/users.preview';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { MenuItem, Popover } from '../../shared/ui/Popover';

const ROLE_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  { value: 'OrgAdmin', label: ROLE_LABEL.OrgAdmin },
  { value: 'BranchAdmin', label: ROLE_LABEL.BranchAdmin },
  { value: 'Lead', label: ROLE_LABEL.Lead },
  { value: 'Mentor', label: ROLE_LABEL.Mentor },
];

/**
 * Presentation-only переименование филиалов (раздел 3 промпта): короткие
 * названия городов вместо технических «Главный офис» / «Филиал N» — только
 * для отображения. `value` фильтров и `user.branchName` остаются прежними,
 * поэтому фильтрация и mock-данные не меняются.
 */
const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  { value: 'Главный офис', label: 'Душанбе' },
  { value: 'Филиал Худжанд', label: 'Худжанд' },
  { value: 'Филиал Бохтар', label: 'Бохтар' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'Active', label: STATUS_LABEL.Active },
  { value: 'Invited', label: STATUS_LABEL.Invited },
  { value: 'Locked', label: STATUS_LABEL.Locked },
  { value: 'Deactivated', label: STATUS_LABEL.Deactivated },
];

const PAGE_SIZE_OPTIONS = [14, 20, 30];

function formatBranchDisplayName(branchName: string): string {
  switch (branchName) {
    case 'Главный офис':
      return 'Душанбе';
    case 'Филиал Худжанд':
      return 'Худжанд';
    case 'Филиал Бохтар':
      return 'Бохтар';
    default:
      return branchName;
  }
}

/**
 * Строгая enterprise-версия роли: маленькая иконка в квадрате + текст, без цветных
 * pill-капсул (раздел 5 промпта). Для Lead нет готового «soft cyan»-токена в теме
 * (только success/warning/danger/info имеют -soft), поэтому фон считаем через
 * `color-mix()` от того же `--secondary-cyan`, что уже используют другие admin-
 * страницы — Tailwind не умеет генерировать opacity-модификатор для произвольных
 * `var()`-значений на этой версии (`bg-[var(--x)]/15` молча не создаёт правило).
 */
const ROLE_META: Record<
  PreviewUserRole,
  { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; tone: string; toneStyle?: CSSProperties }
> = {
  OrgAdmin: { icon: ShieldCheck, label: 'Администратор организации', tone: 'bg-brand-soft text-brand' },
  BranchAdmin: { icon: Building2, label: 'Администратор филиала', tone: 'bg-info-soft text-info' },
  Lead: {
    icon: BriefcaseBusiness,
    label: 'Руководитель',
    tone: 'text-[var(--secondary-cyan)]',
    toneStyle: { backgroundColor: 'color-mix(in srgb, var(--secondary-cyan) 15%, transparent)' },
  },
  Mentor: { icon: UserRound, label: 'Ментор', tone: 'bg-surface-muted text-ink-secondary' },
};

const STATUS_META: Record<PreviewUserStatus, { dot: string; text: string }> = {
  Active: { dot: 'bg-success', text: 'text-success' },
  Invited: { dot: 'bg-info', text: 'text-info' },
  Locked: { dot: 'bg-warning', text: 'text-warning' },
  Deactivated: { dot: 'bg-ink-disabled', text: 'text-ink-muted' },
};

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** `12.05.2024, 11:44` → { primary: '12 мая 2024', secondary: '11:44' }; всё остальное (относительные подписи) не трогаем. */
function formatLastLogin(label: string): { primary: string; secondary?: string } {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}:\d{2})$/.exec(label);
  if (match === null) return { primary: label };
  const [, day, month, year, time] = match;
  const monthName = RU_MONTHS[Number(month) - 1] ?? month;
  return { primary: `${Number(day)} ${monthName} ${year}`, secondary: time };
}

/** Organization Admin не привязан к одному филиалу — область доступа не должна на него намекать (раздел 6 промпта). */
function getAccessScope(user: PreviewUser): { primary: string; secondary?: string } {
  if (user.role === 'OrgAdmin') {
    return { primary: 'Вся организация', secondary: 'Все филиалы' };
  }
  if (user.role === 'BranchAdmin') {
    return { primary: formatBranchDisplayName(user.branchName), secondary: 'Администрирование' };
  }
  return { primary: formatBranchDisplayName(user.branchName), secondary: user.categoryName ?? undefined };
}

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function UserCell({ user }: { user: PreviewUser }): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
        {initialsOf(user.fullName)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold leading-5 text-ink" title={user.fullName}>
          {user.fullName}
        </p>
        <p className="truncate text-[12px] leading-[17px] text-ink-muted" title={user.email}>
          {user.email}
        </p>
      </div>
    </div>
  );
}

function RoleCell({ role }: { role: PreviewUserRole }): JSX.Element {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <div className="flex min-w-0 items-center gap-2.5" title={ROLE_LABEL[role]}>
      <span
        className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-line ${meta.tone}`}
        style={meta.toneStyle}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="truncate text-[12.5px] font-medium text-ink-secondary">{meta.label}</span>
    </div>
  );
}

function ScopeCell({ user }: { user: PreviewUser }): JSX.Element {
  const scope = getAccessScope(user);
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold text-ink">{scope.primary}</p>
      {scope.secondary !== undefined ? <p className="mt-0.5 truncate text-[12px] text-ink-muted">{scope.secondary}</p> : null}
    </div>
  );
}

function StatusCell({ status }: { status: PreviewUserStatus }): JSX.Element {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={`Статус: ${STATUS_LABEL[status]}`}>
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${meta.dot}`} />
      <span className={`text-[13px] font-medium ${meta.text}`}>{STATUS_LABEL[status]}</span>
    </span>
  );
}

function LastLoginCell({ label }: { label: string }): JSX.Element {
  const value = formatLastLogin(label);
  return (
    <div title={label}>
      <p className="whitespace-nowrap text-[13px] tabular-nums text-ink-secondary">{value.primary}</p>
      {value.secondary !== undefined ? <p className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-muted">{value.secondary}</p> : null}
    </div>
  );
}

/** Локальное overflow-меню строки: та же форма, что и общий `PreviewActionMenu`, но с разделителем перед destructive-пунктом (раздел 9 промпта). */
function UserRowActions({ user, onAction }: { user: PreviewUser; onAction: () => void }): JSX.Element {
  return (
    <Popover
      align="right"
      panelClassName="w-56 rounded-dropdown p-1.5 shadow-popover"
      trigger={({ onClick, ref, isOpen }) => (
        <button
          type="button"
          ref={ref}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={`Действия: ${user.fullName}`}
          className="flex h-8 w-8 items-center justify-center rounded-control-sm text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-0.5">
          <MenuItem
            onClick={() => {
              close();
              onAction();
            }}
          >
            Открыть профиль
          </MenuItem>
          <MenuItem
            onClick={() => {
              close();
              onAction();
            }}
          >
            Сменить роль
          </MenuItem>
          <div className="my-1 border-t border-divider" />
          <MenuItem
            destructive
            onClick={() => {
              close();
              onAction();
            }}
          >
            Деактивировать
          </MenuItem>
        </div>
      )}
    </Popover>
  );
}

function ResetFiltersButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface disabled:hover:text-ink-secondary"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Сбросить
    </button>
  );
}

interface UsersPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** Компактный footer-пагинатор (раздел 14 промпта): всегда хотя бы одна страница видна, Prev/Next дизейблятся только на границах. */
function UsersPagination({ page, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange }: UsersPaginationProps): JSX.Element {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3.5 text-[13px] text-ink-muted sm:px-6">
      <span>
        Показано {start}–{end} из {totalCount}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
          На странице
          <select
            aria-label="Пользователей на странице"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
            className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-ink-secondary outline-none transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
            aria-label="Предыдущая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => {
                onPageChange(number);
              }}
              aria-current={number === page ? 'page' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-medium transition ${
                number === page ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:bg-surface-hover'
              }`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
            aria-label="Следующая страница"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * UI-прототип /admin/users — strict enterprise / ultra minimal polish:
 * роль и статус больше не rounded-full pill badges, Scope переименован в
 * «Область доступа» с корректной семантикой Organization Admin, названия
 * филиалов сокращены до городов (presentation-only), график и пагинация
 * компактнее.
 */
export function UsersPage(): JSX.Element {
  // Минимальный deep-link из Dashboard-карточки «Топ 5 менторов» (?q=<имя>) —
  // заполняет уже существующий поиск, визуальный дизайн страницы не меняется.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [role, setRole] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(14);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftRole, setDraftRole] = useState('Mentor');
  const [draftBranch, setDraftBranch] = useState('Главный офис');
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [toastMessage, showToast] = usePreviewToast();

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_USERS.filter((user) => {
      if (query.length > 0 && !user.fullName.toLowerCase().includes(query) && !user.email.toLowerCase().includes(query)) {
        return false;
      }
      if (role !== 'all' && user.role !== role) return false;
      if (branch !== 'all' && user.branchName !== branch) return false;
      if (status !== 'all' && user.status !== status) return false;
      return true;
    });
  }, [search, role, branch, status]);

  useEffect(() => {
    setPage(1);
  }, [search, role, branch, status, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = search.trim().length > 0 || role !== 'all' || branch !== 'all' || status !== 'all';
  const newThisWeek = PREVIEW_NEW_USERS_SERIES[PREVIEW_NEW_USERS_SERIES.length - 1]?.value ?? 0;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Пользователи"
        subtitle="Управление доступом, ролями и участниками организации"
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
        <div className="h-full" title="Руководители направлений">
          <PreviewMetricCard icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} label="Руководители" value={String(PREVIEW_USER_SUMMARY.leads)} />
        </div>
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Менторы" value={String(PREVIEW_USER_SUMMARY.mentors)} />
      </div>

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-5 py-3 sm:px-6">
          <div>
            <h2 className="text-[14px] font-semibold leading-5 text-ink">Новые пользователи</h2>
            <p className="text-[12px] leading-4 text-ink-muted">За последние 30 дней</p>
          </div>
          <div className="text-right">
            <p className="text-[18px] font-bold leading-6 text-ink tabular-nums">+{newThisWeek}</p>
            <p className="text-[11px] leading-4 text-ink-muted">на этой неделе</p>
          </div>
        </div>
        <div className="px-2 pb-3 pt-2 sm:px-3" style={{ height: 116 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PREVIEW_NEW_USERS_SERIES} margin={{ top: 6, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--divider)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="var(--primary)"
                fillOpacity={0.05}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-ink-secondary">{rows.length} пользователей</span>
          <PreviewSearchInput
            placeholder="Поиск по имени или email"
            value={search}
            onChange={setSearch}
            className="!min-w-[300px]"
          />
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} className="w-[124px]" />
          <PreviewSelect label="Роль" value={role} onChange={setRole} options={ROLE_OPTIONS} className="w-[124px]" />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-[124px]" />
          <ResetFiltersButton
            disabled={!filtersActive}
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
            <PreviewTh className="w-[150px] xl:w-[210px] 2xl:w-[240px]">Роль</PreviewTh>
            <PreviewTh className="w-[140px] xl:w-[180px]">Область доступа</PreviewTh>
            <PreviewTh className="w-[120px]">Статус</PreviewTh>
            <PreviewTh className="hidden w-[140px] xl:table-cell">Последний вход</PreviewTh>
            <PreviewTh className="w-11" />
          </PreviewTableHead>
          <tbody>
            {pageRows.map((user) => (
              <tr key={user.id} className="h-[60px] border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 hover:bg-surface-hover">
                <PreviewTd>
                  <UserCell user={user} />
                </PreviewTd>
                <PreviewTd>
                  <RoleCell role={user.role} />
                </PreviewTd>
                <PreviewTd>
                  <ScopeCell user={user} />
                </PreviewTd>
                <PreviewTd>
                  <StatusCell status={user.status} />
                </PreviewTd>
                <PreviewTd className="hidden xl:table-cell">
                  <LastLoginCell label={user.lastLoginLabel} />
                </PreviewTd>
                <PreviewTd className="text-center">
                  <UserRowActions
                    user={user}
                    onAction={() => {
                      showToast('Функция будет подключена позже');
                    }}
                  />
                </PreviewTd>
              </tr>
            ))}
          </tbody>
        </PreviewTable>

        <UsersPagination
          page={currentPage}
          totalPages={totalPages}
          totalCount={rows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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
