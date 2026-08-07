import { Plus, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { useSearchParams } from 'react-router-dom';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { BRANCH_DIRECTORY } from '../../features/admin-preview/branchDirectory';
import { BlockUserDialog } from '../../features/admin-users/BlockUserDialog';
import { ChangeUserRoleDialog } from '../../features/admin-users/ChangeUserRoleDialog';
import { DeactivateUserDialog } from '../../features/admin-users/DeactivateUserDialog';
import { ResendInvitationDialog } from '../../features/admin-users/ResendInvitationDialog';
import { SendPasswordResetDialog } from '../../features/admin-users/SendPasswordResetDialog';
import { TransferUserDialog } from '../../features/admin-users/TransferUserDialog';
import { UnblockUserDialog } from '../../features/admin-users/UnblockUserDialog';
import { UserActionMenu } from '../../features/admin-users/UserActionMenu';
import { UserDetailsDrawer } from '../../features/admin-users/UserDetailsDrawer';
import { UserFormDrawer } from '../../features/admin-users/UserFormDrawer';
import type { UserFormDrawerState } from '../../features/admin-users/UserFormDrawer';
import { useUserPreviewActions } from '../../features/admin-users/useUserPreviewActions';
import { branchDisplayName, ROLE_ICON, ROLE_TONE, STATUS_META } from '../../features/admin-users/userPresentation';
import type { PreviewUserDetails } from '../../features/admin-users/userPresentation';
import { useUsersPreview } from '../../features/admin-users/userPreviewStore';
import { ROLE_LABEL, STATUS_LABEL, PREVIEW_NEW_USERS_SERIES } from '../../mocks/ui-preview/users.preview';
import type { PreviewUserRole, PreviewUserStatus } from '../../mocks/ui-preview/users.preview';
import { useAuth } from '../../auth/useAuth';
import { Select } from '../../shared/select';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

const ROLE_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  { value: 'OrgAdmin', label: ROLE_LABEL.OrgAdmin },
  { value: 'BranchAdmin', label: ROLE_LABEL.BranchAdmin },
  { value: 'Lead', label: ROLE_LABEL.Lead },
  { value: 'Mentor', label: ROLE_LABEL.Mentor },
];

const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  ...BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName })),
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'Active', label: STATUS_LABEL.Active },
  { value: 'Invited', label: STATUS_LABEL.Invited },
  { value: 'Locked', label: STATUS_LABEL.Locked },
  { value: 'Deactivated', label: STATUS_LABEL.Deactivated },
];

const PAGE_SIZE_OPTIONS = [14, 20, 30];

const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatLastLogin(label: string): { primary: string; secondary?: string } {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}:\d{2})$/.exec(label);
  if (match === null) return { primary: label };
  const [, day, month, year, time] = match;
  const monthName = RU_MONTHS[Number(month) - 1] ?? month;
  return { primary: `${Number(day)} ${monthName} ${year}`, secondary: time };
}

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function getAccessScope(user: PreviewUserDetails): { primary: string; secondary?: string } {
  if (user.role === 'OrgAdmin') return { primary: 'Вся организация', secondary: 'Все филиалы' };
  if (user.role === 'BranchAdmin') return { primary: branchDisplayName(user.branchName), secondary: 'Администрирование' };
  return { primary: branchDisplayName(user.branchName), secondary: user.categoryName ?? undefined };
}

function UserCell({ user }: { user: PreviewUserDetails }): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">{initialsOf(user.fullName)}</span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold leading-5 text-ink" title={user.fullName}>{user.fullName}</p>
        <p className="truncate text-[12px] leading-[17px] text-ink-muted" title={user.email}>{user.email}</p>
      </div>
    </div>
  );
}

function RoleCell({ role }: { role: PreviewUserRole }): JSX.Element {
  const Icon = ROLE_ICON[role];
  const tone = ROLE_TONE[role];
  return (
    <div className="flex min-w-0 items-center gap-2.5" title={ROLE_LABEL[role]}>
      <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-line ${tone.className}`} style={tone.style}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="truncate text-[12.5px] font-medium text-ink-secondary">{ROLE_LABEL[role]}</span>
    </div>
  );
}

function ScopeCell({ user }: { user: PreviewUserDetails }): JSX.Element {
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

interface UsersPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function UsersPagination({ page, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange }: UsersPaginationProps): JSX.Element {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3.5 text-[13px] text-ink-muted sm:px-6">
      <span>Показано {start}–{end} из {totalCount}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
          На странице
          <Select
            ariaLabel="Пользователей на странице"
            size="sm"
            value={String(pageSize)}
            onValueChange={(next) => { onPageSizeChange(Number(next)); }}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
            className="w-[68px]"
          />
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => { onPageChange(page - 1); }} aria-label="Предыдущая страница" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent">
            ‹
          </button>
          {pageNumbers.map((number) => (
            <button key={number} type="button" onClick={() => { onPageChange(number); }} aria-current={number === page ? 'page' : undefined} className={`flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-medium transition ${number === page ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:bg-surface-hover'}`}>
              {number}
            </button>
          ))}
          <button type="button" disabled={page >= totalPages} onClick={() => { onPageChange(page + 1); }} aria-label="Следующая страница" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

type ActionDialogState =
  | { type: 'changeRole'; user: PreviewUserDetails }
  | { type: 'transfer'; user: PreviewUserDetails }
  | { type: 'resendInvitation'; user: PreviewUserDetails }
  | { type: 'passwordReset'; user: PreviewUserDetails }
  | { type: 'block'; user: PreviewUserDetails }
  | { type: 'unblock'; user: PreviewUserDetails }
  | { type: 'deactivate'; user: PreviewUserDetails };

/**
 * /admin/users — этап 2: реальные Drawer/Dialog поверх shared overlay system
 * (раздел 45 промпта). Branch Admin видит и создаёт пользователей только
 * своего филиала (раздел 24 acceptance criteria — branch isolation).
 */
export function UsersPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const currentBranchRawName = authUser?.branch?.name ?? null;

  const allUsers = useUsersPreview();
  const scopedUsers = useMemo(
    () => (isOrgAdmin ? allUsers : allUsers.filter((candidate) => candidate.branchName === currentBranchRawName)),
    [allUsers, isOrgAdmin, currentBranchRawName],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [role, setRole] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(14);
  const [formDrawer, setFormDrawer] = useState<UserFormDrawerState | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);

  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const userId = searchParams.get('userId');

  useEffect(() => {
    if (userId === null) return;
    rowRefs.current.get(userId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [userId]);

  function openUserDetails(id: string): void {
    const next = new URLSearchParams(searchParams);
    next.set('userId', id);
    setSearchParams(next);
  }

  function closeUserDetails(): void {
    const next = new URLSearchParams(searchParams);
    next.delete('userId');
    setSearchParams(next);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedUsers.filter((candidate) => {
      if (query.length > 0 && !candidate.fullName.toLowerCase().includes(query) && !candidate.email.toLowerCase().includes(query)) return false;
      if (role !== 'all' && candidate.role !== role) return false;
      if (branch !== 'all' && candidate.branchName !== branch) return false;
      if (status !== 'all' && candidate.status !== status) return false;
      return true;
    });
  }, [scopedUsers, search, role, branch, status]);

  useEffect(() => {
    setPage(1);
  }, [search, role, branch, status, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = search.trim().length > 0 || role !== 'all' || branch !== 'all' || status !== 'all';
  const newThisWeek = PREVIEW_NEW_USERS_SERIES[PREVIEW_NEW_USERS_SERIES.length - 1]?.value ?? 0;

  const summary = useMemo(
    () => ({
      total: scopedUsers.length,
      admins: scopedUsers.filter((candidate) => candidate.role === 'OrgAdmin' || candidate.role === 'BranchAdmin').length,
      leads: scopedUsers.filter((candidate) => candidate.role === 'Lead').length,
      mentors: scopedUsers.filter((candidate) => candidate.role === 'Mentor').length,
    }),
    [scopedUsers],
  );

  const actions = useUserPreviewActions();

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Пользователи"
        subtitle="Управление доступом, ролями и участниками организации"
        action={
          <Button variant="primary" leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setFormDrawer({ mode: 'create' }); }}>
            Добавить пользователя
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Всего" value={String(summary.total)} />
        <PreviewMetricCard icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} label="Администраторы" value={String(summary.admins)} />
        <div className="h-full" title="Руководители направлений">
          <PreviewMetricCard icon={<UserCheck className="h-5 w-5" aria-hidden="true" />} label="Руководители" value={String(summary.leads)} />
        </div>
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Менторы" value={String(summary.mentors)} />
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
              <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 4px 10px rgba(16,24,40,0.08)', fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fill="var(--primary)" fillOpacity={0.05} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-ink-secondary">{rows.length} пользователей</span>
          <PreviewSearchInput placeholder="Поиск по имени или email" value={search} onChange={setSearch} className="!min-w-[300px]" />
          {isOrgAdmin ? <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} className="w-[124px]" /> : null}
          <PreviewSelect label="Роль" value={role} onChange={setRole} options={ROLE_OPTIONS} className="w-[124px]" />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-[124px]" />
          <button
            type="button"
            disabled={!filtersActive}
            onClick={() => { setSearch(''); setRole('all'); setBranch('all'); setStatus('all'); }}
            className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium text-ink-secondary transition hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45"
          >
            Сбросить
          </button>
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
            {pageRows.map((rowUser) => (
              <tr
                key={rowUser.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(rowUser.id, node);
                  else rowRefs.current.delete(rowUser.id);
                }}
                tabIndex={0}
                onClick={() => { openUserDetails(rowUser.id); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openUserDetails(rowUser.id);
                  }
                }}
                className={`h-[60px] cursor-pointer border-b border-divider text-sm outline-none transition-colors duration-150 last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                  rowUser.id === userId ? 'bg-brand-soft' : 'hover:bg-surface-hover'
                }`}
              >
                <PreviewTd><UserCell user={rowUser} /></PreviewTd>
                <PreviewTd><RoleCell role={rowUser.role} /></PreviewTd>
                <PreviewTd><ScopeCell user={rowUser} /></PreviewTd>
                <PreviewTd><StatusCell status={rowUser.status} /></PreviewTd>
                <PreviewTd className="hidden xl:table-cell"><LastLoginCell label={rowUser.lastLoginLabel} /></PreviewTd>
                <PreviewTd
                  className="text-center"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <UserActionMenu
                    user={rowUser}
                    context="row"
                    isOrgAdmin={isOrgAdmin}
                    onOpenProfile={() => { openUserDetails(rowUser.id); }}
                    onEdit={() => { setFormDrawer({ mode: 'edit', userId: rowUser.id }); }}
                    onChangeRole={() => { setActionDialog({ type: 'changeRole', user: rowUser }); }}
                    onTransfer={() => { setActionDialog({ type: 'transfer', user: rowUser }); }}
                    onResendInvitation={() => { setActionDialog({ type: 'resendInvitation', user: rowUser }); }}
                    onRequestPasswordReset={() => { setActionDialog({ type: 'passwordReset', user: rowUser }); }}
                    onBlock={() => { setActionDialog({ type: 'block', user: rowUser }); }}
                    onUnblock={() => { setActionDialog({ type: 'unblock', user: rowUser }); }}
                    onDeactivate={() => { setActionDialog({ type: 'deactivate', user: rowUser }); }}
                  />
                </PreviewTd>
              </tr>
            ))}
          </tbody>
        </PreviewTable>

        <UsersPagination page={currentPage} totalPages={totalPages} totalCount={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      <UserDetailsDrawer
        userId={userId}
        users={scopedUsers}
        onClose={closeUserDetails}
        isOrgAdmin={isOrgAdmin}
        onEdit={(target) => { setFormDrawer({ mode: 'edit', userId: target.id }); }}
        onChangeRole={(target) => { setActionDialog({ type: 'changeRole', user: target }); }}
        onTransfer={(target) => { setActionDialog({ type: 'transfer', user: target }); }}
        onResendInvitation={(target) => { setActionDialog({ type: 'resendInvitation', user: target }); }}
        onRequestPasswordReset={(target) => { setActionDialog({ type: 'passwordReset', user: target }); }}
        onBlock={(target) => { setActionDialog({ type: 'block', user: target }); }}
        onUnblock={(target) => { setActionDialog({ type: 'unblock', user: target }); }}
        onDeactivate={(target) => { setActionDialog({ type: 'deactivate', user: target }); }}
      />

      <UserFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} isOrgAdmin={isOrgAdmin} currentBranchRawName={currentBranchRawName} />

      <ChangeUserRoleDialog
        user={actionDialog?.type === 'changeRole' ? actionDialog.user : null}
        open={actionDialog?.type === 'changeRole'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isOrgAdmin={isOrgAdmin}
        currentBranchRawName={currentBranchRawName}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'changeRole') await actions.changeRole(actionDialog.user.id, input);
        }}
      />

      <TransferUserDialog
        user={actionDialog?.type === 'transfer' ? actionDialog.user : null}
        open={actionDialog?.type === 'transfer'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'transfer') await actions.transferUser(actionDialog.user.id, input);
        }}
      />

      <ResendInvitationDialog
        user={actionDialog?.type === 'resendInvitation' ? actionDialog.user : null}
        open={actionDialog?.type === 'resendInvitation'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'resendInvitation') await actions.resendInvitation(actionDialog.user.id);
        }}
      />

      <SendPasswordResetDialog
        user={actionDialog?.type === 'passwordReset' ? actionDialog.user : null}
        open={actionDialog?.type === 'passwordReset'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'passwordReset') await actions.requestPasswordReset(actionDialog.user.id);
        }}
      />

      <BlockUserDialog
        user={actionDialog?.type === 'block' ? actionDialog.user : null}
        open={actionDialog?.type === 'block'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'block') await actions.blockUser(actionDialog.user.id, input);
        }}
      />

      <UnblockUserDialog
        user={actionDialog?.type === 'unblock' ? actionDialog.user : null}
        open={actionDialog?.type === 'unblock'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'unblock') await actions.unblockUser(actionDialog.user.id);
        }}
      />

      <DeactivateUserDialog
        user={actionDialog?.type === 'deactivate' ? actionDialog.user : null}
        open={actionDialog?.type === 'deactivate'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async () => {
          if (actionDialog?.type === 'deactivate') await actions.deactivateUser(actionDialog.user.id);
        }}
      />
    </div>
  );
}
