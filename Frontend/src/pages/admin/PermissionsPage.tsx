import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, UserRoundCog } from 'lucide-react';
import { useMemo, useState } from 'react';

import { getPermissionExceptions, getRoleMatrix, setRoleRule } from '../../api/admin/permissions';
import type { PermissionException, PermissionSubject, RolePermissionCell, RolePermissionRow } from '../../api/admin/permissions';
import { listUsers } from '../../api/admin/users';
import { getGenericErrorMessage } from '../../api/problemDetails';
import { useAuth } from '../../auth/useAuth';
import { UserPermissionsEditor } from '../../features/admin-permissions/UserPermissionsEditor';
import { PERMISSION_GROUP_LABEL, PERMISSION_INFO, SUBJECT_LABEL, SUBJECTS, permissionLabel } from '../../features/admin-permissions/permissionPresentation';
import { PERMISSIONS_KEY } from '../../features/admin-permissions/useUserPermissions';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { Drawer, useToast } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { FormField } from '../../shared/ui/FormField';
import { Skeleton } from '../../shared/ui/Skeleton';
import { Switch } from '../../shared/ui/Switch';
import { Tooltip } from '../../shared/ui/Tooltip';

const MATRIX_KEY = [...PERMISSIONS_KEY, 'roles'] as const;
const EXCEPTIONS_KEY = [...PERMISSIONS_KEY, 'exceptions'] as const;

const ROLE_LABEL: Record<string, string> = { Admin: 'Админ филиала', Lead: 'Тимлид', Mentor: 'Ментор' };

/** Строка матрицы: одно действие, столбцы — роли. Ячейка без права — прочерк, а не выключенный тумблер. */
function MatrixRow({ row, editable, onChange }: {
  row: RolePermissionRow;
  editable: boolean;
  onChange: (subject: PermissionSubject, allowed: boolean | null) => void;
}): JSX.Element {
  const info = PERMISSION_INFO[row.key];
  const cellOf = (subject: PermissionSubject): RolePermissionCell | undefined => row.cells.find((cell) => cell.subject === subject);

  return (
    <tr className="border-t border-divider">
      <td className="py-2.5 pl-5 pr-3 sm:pl-6">
        <p className="text-[13px] font-medium text-ink">{info?.label ?? row.key}</p>
        <p className="text-[11.5px] text-ink-muted">{info?.hint}</p>
      </td>
      {SUBJECTS.map((subject) => {
        const cell = cellOf(subject);
        return (
          <td key={subject} className="w-[118px] px-2 py-2.5 text-center">
            {cell === undefined ? (
              <span className="text-ink-disabled" aria-label={`${SUBJECT_LABEL[subject]}: не относится`}>—</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Switch
                  checked={cell.effective}
                  disabled={!editable}
                  label={`${SUBJECT_LABEL[subject]}: ${info?.label ?? row.key}`}
                  onChange={(next) => { onChange(subject, next); }}
                />
                {cell.rule !== null && editable ? (
                  <Tooltip content="Вернуть значение по умолчанию">
                    <button
                      type="button"
                      aria-label={`Вернуть значение по умолчанию: ${SUBJECT_LABEL[subject]}`}
                      onClick={() => { onChange(subject, null); }}
                      className="grid h-6 w-6 place-items-center rounded-control-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                ) : <span className="h-6 w-6" aria-hidden="true" />}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function ExceptionRow({ item, onOpen }: { item: PermissionException; onOpen: () => void }): JSX.Element {
  const place = [item.branchName, item.categoryName].filter(Boolean).join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-6"
      >
        <Avatar name={item.fullName} size="sm" />
        <span className="min-w-[160px] flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink">{item.fullName}</span>
          <span className="block truncate text-[12px] text-ink-muted">{ROLE_LABEL[item.role] ?? item.role}{place.length > 0 ? ` · ${place}` : ''}</span>
        </span>
        <span className="flex flex-wrap justify-end gap-1.5">
          {item.denied.map((key) => <Badge key={key} tone="danger">Запрещено: {permissionLabel(key)}</Badge>)}
          {item.allowed.map((key) => <Badge key={key} tone="success">Разрешено: {permissionLabel(key)}</Badge>)}
        </span>
      </button>
    </li>
  );
}

/**
 * `/admin/permissions`. Одна таблица на всю организацию: строки — действия, столбцы — роли, поэтому
 * права сравниваются взглядом. Ниже только люди, чьи права отличаются от их роли: это короткий список,
 * и его достаточно, чтобы увидеть все исключения сразу. Права роли меняет только владелец.
 */
export function PermissionsPage(): JSX.Element {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.adminScope === 'Organization';

  const matrix = useQuery({ queryKey: MATRIX_KEY, queryFn: getRoleMatrix });
  const exceptions = useQuery({ queryKey: EXCEPTIONS_KEY, queryFn: getPermissionExceptions });
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'list', user?.organization.id ?? 'anonymous'],
    queryFn: () => listUsers({ page: 1, pageSize: 100 }),
  });

  const [pickedUserId, setPickedUserId] = useState('');
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ subject, permission, allowed }: { subject: PermissionSubject; permission: string; allowed: boolean | null }) =>
      setRoleRule(subject, permission, allowed).catch((error: unknown) => { throw new Error(getGenericErrorMessage(error)); }),
    onSuccess: (rows) => { queryClient.setQueryData(MATRIX_KEY, rows); },
    onError: (error) => { toast.error(error instanceof Error ? error.message : 'Не удалось изменить право'); },
  });

  const rows = useMemo(() => matrix.data ?? [], [matrix.data]);
  const groups = useMemo(() => [...new Set(rows.map((row) => row.group))], [rows]);

  const peopleOptions = useMemo(
    () => (usersQuery.data?.items ?? [])
      .filter((candidate) => candidate.id !== user?.id && candidate.isActive && (candidate.role !== 'Admin' || (isOwner && candidate.adminScope === 'Branch')))
      .map((candidate) => ({ value: candidate.id, label: candidate.fullName, description: ROLE_LABEL[candidate.role] ?? candidate.role })),
    [usersQuery.data, user?.id, isOwner],
  );

  const openName = peopleOptions.find((option) => option.value === openUserId)?.label
    ?? exceptions.data?.find((item) => item.userId === openUserId)?.fullName
    ?? 'Права пользователя';

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Права доступа"
        subtitle={isOwner ? 'Что могут роли и кому сделано исключение' : 'Права ролей задаёт владелец. Вы можете сделать исключение для людей своего филиала'}
      />

      <Card padded={false} className="min-w-0 overflow-hidden">
        {matrix.isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}</div>
        ) : matrix.error !== null ? (
          <div className="px-5 py-2"><ErrorState error={matrix.error} title="Не удалось загрузить права" onRetry={() => { void matrix.refetch(); }} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">Права по ролям</caption>
              <thead>
                <tr className="text-[12px] font-semibold text-ink-secondary">
                  <th scope="col" className="py-3 pl-5 pr-3 text-left sm:pl-6">Действие</th>
                  {SUBJECTS.map((subject) => <th key={subject} scope="col" className="w-[118px] px-2 py-3 text-center">{SUBJECT_LABEL[subject]}</th>)}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group}>
                  <tr className="border-t border-divider bg-surface-muted">
                    <th scope="colgroup" colSpan={SUBJECTS.length + 1} className="py-1.5 pl-5 text-left text-[11.5px] font-semibold text-ink-muted sm:pl-6">
                      {PERMISSION_GROUP_LABEL[group] ?? group}
                    </th>
                  </tr>
                  {rows.filter((row) => row.group === group).map((row) => (
                    <MatrixRow
                      key={row.key}
                      row={row}
                      editable={isOwner}
                      onChange={(subject, allowed) => { mutation.mutate({ subject, permission: row.key, allowed }); }}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </Card>

      <Card padded={false} className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Исключения</h2>
            <p className="text-[12.5px] text-ink-muted">Люди, чьи права отличаются от их роли</p>
          </div>
          <FormField label="Настроить человека" htmlFor="permissions-person" className="w-full sm:w-72">
            <SearchSelect
              id="permissions-person"
              value={pickedUserId}
              onValueChange={(id) => { setPickedUserId(''); setOpenUserId(id); }}
              options={peopleOptions}
              placeholder="Выберите пользователя"
              searchPlaceholder="Поиск по имени"
            />
          </FormField>
        </div>

        {exceptions.isPending ? (
          <div className="space-y-2 px-5 pb-5"><Skeleton className="h-12 w-full" /></div>
        ) : exceptions.error !== null ? (
          <div className="px-5 py-2"><ErrorState error={exceptions.error} title="Не удалось загрузить исключения" onRetry={() => { void exceptions.refetch(); }} /></div>
        ) : (exceptions.data ?? []).length === 0 ? (
          <div className="border-t border-divider">
            <EmptyState icon={<UserRoundCog className="h-5 w-5" aria-hidden="true" />} title="Исключений нет" description="У всех права как у их роли. Выберите человека выше, чтобы сделать исключение." />
          </div>
        ) : (
          <ul className="divide-y divide-divider border-t border-divider">
            {(exceptions.data ?? []).map((item) => (
              <ExceptionRow key={item.userId} item={item} onOpen={() => { setOpenUserId(item.userId); }} />
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={openUserId !== null}
        onOpenChange={(next) => { if (!next) setOpenUserId(null); }}
        title={openName}
        description="Личные исключения из прав роли"
      >
        {openUserId !== null ? <UserPermissionsEditor userId={openUserId} /> : null}
      </Drawer>
    </div>
  );
}
