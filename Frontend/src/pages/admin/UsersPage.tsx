import { Plus, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { useSearchParams } from 'react-router-dom';

import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewActionCell, PreviewActionTh, PreviewPagination, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
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
import { useUserActions } from '../../features/admin-users/useUserActions';
import { useUsersQuery } from '../../features/admin-users/useUsersQuery';
import { branchDisplayName, ROLE_ICON, ROLE_TONE, STATUS_META } from '../../features/admin-users/userPresentation';
import type { PreviewUserDetails } from '../../features/admin-users/userPresentation';
import { ROLE_LABEL, STATUS_LABEL } from '../../mocks/ui-preview/users.preview';
import type { PreviewUserRole, PreviewUserStatus } from '../../mocks/ui-preview/users.preview';
import { useAuth } from '../../auth/useAuth';
import { useBranchContext } from '../../features/branch-context/useBranchContext';
import { Button } from '../../shared/ui/Button';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useToast } from '../../shared/overlays';
import { Card } from '../../shared/ui/Card';
import { ErrorState } from '../../shared/ui/ErrorState';

const ROLE_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  { value: 'OrgAdmin', label: ROLE_LABEL.OrgAdmin },
  { value: 'BranchAdmin', label: ROLE_LABEL.BranchAdmin },
  { value: 'Lead', label: ROLE_LABEL.Lead },
  { value: 'Mentor', label: ROLE_LABEL.Mentor },
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

function buildNewUsersSeries(users: readonly PreviewUserDetails[]): { label: string; value: number }[] {
  const now = new Date();
  return Array.from({ length: 5 }, (_, index) => {
    const end = new Date(now);
    end.setDate(now.getDate() - (4 - index) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const value = users.filter((user) => {
      const created = new Date(user.createdLabel.split('.').reverse().join('-'));
      return created >= start && created <= end;
    }).length;
    return { label: `${String(start.getDate()).padStart(2, '0')}.${String(start.getMonth() + 1).padStart(2, '0')}`, value };
  });
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

type ActionDialogState =
  | { type: 'changeRole'; user: PreviewUserDetails }
  | { type: 'transfer'; user: PreviewUserDetails }
  | { type: 'resendInvitation'; user: PreviewUserDetails }
  | { type: 'passwordReset'; user: PreviewUserDetails }
  | { type: 'block'; user: PreviewUserDetails }
  | { type: 'unblock'; user: PreviewUserDetails }
  | { type: 'deactivate'; user: PreviewUserDetails };

/**
 * /admin/users — подключено к реальному API (`GET/POST /users` + `change-role`/`change-branch`/
 * `activate`/`deactivate`/`resend-invitation`). Branch Admin видит и создаёт пользователей только
 * своего филиала — сервер сам сужает список (`UserService.ApplyVisibility`), клиентский фильтр
 * по филиалу — для Organization Admin, который видит всю организацию сразу.
 */
export function UsersPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const branchContext = useBranchContext();
  // Единственный источник правды для «это Organization Admin?» — `BranchContext.tsx` уже вычисляет
  // это с полной проверкой (`role === 'Admin' && adminScope === 'Organization'`), которая же решает,
  // запускать ли `GET /branches` вообще (`enabled: isOrgAdmin` там же). Использовать здесь локально
  // упрощённую проверку (`adminScope === 'Organization'` без `role`) означало бы, что при расхождении
  // форма показала бы редактируемый выбор филиала, для которого сам провайдер списка так и не сделал
  // запрос — пустой dropdown без объяснения причины.
  const isOrgAdmin = branchContext.canOverrideBranch;

  const usersQuery = useUsersQuery();
  const allUsers = usersQuery.users;

  const branchOptions = useMemo(
    () => [
      { value: 'all', label: 'Все филиалы' },
      ...branchContext.availableBranches.map((branch) => ({ value: branch.name, label: branch.name })),
    ],
    [branchContext.availableBranches],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [role, setRole] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('Active');
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
    return allUsers.filter((candidate) => {
      if (query.length > 0 && !candidate.fullName.toLowerCase().includes(query) && !candidate.email.toLowerCase().includes(query)) return false;
      if (role !== 'all' && candidate.role !== role) return false;
      if (branch !== 'all' && candidate.branchName !== branch) return false;
      if (status !== 'all' && candidate.status !== status) return false;
      return true;
    });
  }, [allUsers, search, role, branch, status]);

  useEffect(() => {
    setPage(1);
  }, [search, role, branch, status, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = search.trim().length > 0 || role !== 'all' || branch !== 'all' || status !== 'all';
  const newUsersSeries = useMemo(() => buildNewUsersSeries(allUsers), [allUsers]);
  const newThisWeek = newUsersSeries[newUsersSeries.length - 1]?.value ?? 0;

  const summary = useMemo(() => {
    // "Всего"/разбивка по ролям — это состав команды, а не полная история строк в базе (та
    // остаётся доступна через фильтр статуса и Журнал аудита): только те, кто реально принял
    // приглашение (status === 'Active', не 'Invited'/'Locked'/'Deactivated'), и без владельца
    // организации (OrgAdmin) — это учётная запись владельца, не управляемый член команды
    // (запрос 2026-09-25).
    const team = allUsers.filter((candidate) => candidate.status === 'Active' && candidate.role !== 'OrgAdmin');
    return {
      total: team.length,
      admins: team.filter((candidate) => candidate.role === 'BranchAdmin').length,
      leads: team.filter((candidate) => candidate.role === 'Lead').length,
      mentors: team.filter((candidate) => candidate.role === 'Mentor').length,
    };
  }, [allUsers]);

  const actions = useUserActions();
  const toast = useToast();

  async function handleActivate(target: PreviewUserDetails): Promise<void> {
    try {
      await actions.activateUser(target.id, target.concurrencyToken ?? '');
    } catch (error) {
      toast.error(getGenericErrorMessage(error));
    }
  }

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
            <AreaChart data={newUsersSeries} margin={{ top: 6, right: 12, bottom: 0, left: 4 }}>
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
          <span className="basis-full text-[13px] font-medium text-ink-secondary">{rows.length} пользователей</span>
          <PreviewSearchInput placeholder="Поиск по имени или email" value={search} onChange={setSearch} />
          {isOrgAdmin ? <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={branchOptions} width="lg" /> : null}
          <PreviewSelect label="Роль" value={role} onChange={setRole} options={ROLE_OPTIONS} width="md" />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} width="sm" />
          <PreviewResetButton
            disabled={!filtersActive}
            onClick={() => { setSearch(''); setRole('all'); setBranch('all'); setStatus('Active'); }}
          />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh>Пользователь</PreviewTh>
            <PreviewTh className="w-[150px] xl:w-[210px] 2xl:w-[240px]">Роль</PreviewTh>
            <PreviewTh className="w-[140px] xl:w-[180px]">Область доступа</PreviewTh>
            <PreviewTh className="w-[120px]">Статус</PreviewTh>
            <PreviewTh className="hidden w-[140px] xl:table-cell">Последний вход</PreviewTh>
            <PreviewActionTh />
          </PreviewTableHead>
          <tbody>
            {usersQuery.isPending ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-ink-muted sm:px-6">
                  Загрузка пользователей…
                </td>
              </tr>
            ) : usersQuery.error !== null ? (
              <tr>
                <td colSpan={6} className="px-5 py-2 sm:px-6">
                  <ErrorState error={usersQuery.error} title="Не удалось загрузить пользователей" onRetry={usersQuery.refetch} />
                </td>
              </tr>
            ) : (
              pageRows.map((rowUser) => (
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
                <PreviewActionCell
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <UserActionMenu
                    user={rowUser}
                    context="row"
                    isOrgAdmin={isOrgAdmin}
                    isSelf={rowUser.id === currentUserId}
                    onOpenProfile={() => { openUserDetails(rowUser.id); }}
                    onEdit={() => { setFormDrawer({ mode: 'edit', userId: rowUser.id }); }}
                    onActivate={() => { void handleActivate(rowUser); }}
                    onChangeRole={() => { setActionDialog({ type: 'changeRole', user: rowUser }); }}
                    onTransfer={() => { setActionDialog({ type: 'transfer', user: rowUser }); }}
                    onResendInvitation={() => { setActionDialog({ type: 'resendInvitation', user: rowUser }); }}
                    onRequestPasswordReset={() => { setActionDialog({ type: 'passwordReset', user: rowUser }); }}
                    onBlock={() => { setActionDialog({ type: 'block', user: rowUser }); }}
                    onUnblock={() => { setActionDialog({ type: 'unblock', user: rowUser }); }}
                    onDeactivate={() => { setActionDialog({ type: 'deactivate', user: rowUser }); }}
                  />
                </PreviewActionCell>
              </tr>
              ))
            )}
          </tbody>
        </PreviewTable>

        <PreviewPagination page={currentPage} totalPages={totalPages} totalCount={rows.length} pageSize={pageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      <UserDetailsDrawer
        userId={userId}
        users={allUsers}
        onClose={closeUserDetails}
        isOrgAdmin={isOrgAdmin}
        currentUserId={currentUserId}
        onEdit={(target) => { setFormDrawer({ mode: 'edit', userId: target.id }); }}
        onActivate={(target) => { void handleActivate(target); }}
        onChangeRole={(target) => { setActionDialog({ type: 'changeRole', user: target }); }}
        onTransfer={(target) => { setActionDialog({ type: 'transfer', user: target }); }}
        onResendInvitation={(target) => { setActionDialog({ type: 'resendInvitation', user: target }); }}
        onRequestPasswordReset={(target) => { setActionDialog({ type: 'passwordReset', user: target }); }}
        onBlock={(target) => { setActionDialog({ type: 'block', user: target }); }}
        onUnblock={(target) => { setActionDialog({ type: 'unblock', user: target }); }}
        onDeactivate={(target) => { setActionDialog({ type: 'deactivate', user: target }); }}
      />

      <UserFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} isOrgAdmin={isOrgAdmin} />

      <ChangeUserRoleDialog
        user={actionDialog?.type === 'changeRole' ? actionDialog.user : null}
        open={actionDialog?.type === 'changeRole'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isOrgAdmin={isOrgAdmin}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'changeRole') await actions.changeRole(actionDialog.user.id, actionDialog.user.concurrencyToken ?? '', input);
        }}
      />

      <TransferUserDialog
        user={actionDialog?.type === 'transfer' ? actionDialog.user : null}
        open={actionDialog?.type === 'transfer'}
        onOpenChange={(next) => { if (!next) setActionDialog(null); }}
        isSubmitting={actions.isSubmitting}
        onConfirm={async (input) => {
          if (actionDialog?.type === 'transfer') await actions.transferUser(actionDialog.user.id, actionDialog.user.concurrencyToken ?? '', input);
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
        onConfirm={async () => {
          if (actionDialog?.type === 'block') await actions.blockUser(actionDialog.user.id);
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
          if (actionDialog?.type === 'deactivate') await actions.deactivateUser(actionDialog.user.id, actionDialog.user.concurrencyToken ?? '');
        }}
      />
    </div>
  );
}
