import { useEffect, useMemo, useState } from 'react';

import type { AssignmentDto } from '../../api/lead/assignments';
import type { UserDto } from '../../api/admin/users';
import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField } from '../../shared/ui/FormField';
import { assignablePeople, personOption } from './assignablePeople';

export interface AdminReassignDialogProps {
  assignment: AssignmentDto | null;
  users: UserDto[];
  categoryName: string | undefined;
  onClose: () => void;
  onConfirm: (assigneeId: string) => Promise<void>;
}

/** Направление задания не меняется: снимок контура неизменен, поэтому кандидаты только из него. */
export function AdminReassignDialog({ assignment, users, categoryName, onClose, onConfirm }: AdminReassignDialogProps): JSX.Element {
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => { setAssigneeId(''); }, [assignment]);

  const options = useMemo(
    () => assignablePeople(users)
      .filter((user) => user.categoryId === assignment?.categoryId && user.id !== assignment?.assignedToId)
      .map((user) => personOption(user, categoryName)),
    [users, assignment, categoryName],
  );

  return (
    <ConfirmDialog
      open={assignment !== null}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Переназначить задание"
      description={`«${assignment?.title ?? ''}» перейдёт другому исполнителю этого направления.`}
      confirmLabel="Переназначить"
      confirmDisabled={assigneeId.length === 0}
      onConfirm={() => onConfirm(assigneeId)}
      details={
        <FormField label="Новый исполнитель" htmlFor="admin-reassign-person" required hint={options.length === 0 ? 'В этом направлении больше никого нет' : undefined}>
          <SearchSelect id="admin-reassign-person" value={assigneeId} onValueChange={setAssigneeId} options={options} placeholder="Выберите человека" searchPlaceholder="Поиск по имени" />
        </FormField>
      }
    />
  );
}
