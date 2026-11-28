import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/useAuth';
import type { AssignmentDto } from '../../api/lead/assignments';
import type { UserDto } from '../../api/admin/users';
import { ConfirmDialog } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { FormField } from '../../shared/ui/FormField';
import { assignableSeats, seatOption } from './assignablePeople';

export interface AdminReassignDialogProps {
  assignment: AssignmentDto | null;
  users: UserDto[];
  categoryName: string | undefined;
  onClose: () => void;
  onConfirm: (assigneeId: string) => Promise<void>;
}

/** Направление задания не меняется: снимок контура неизменен, поэтому кандидаты только из него. */
export function AdminReassignDialog({ assignment, users, categoryName, onClose, onConfirm }: AdminReassignDialogProps): JSX.Element {
  const selfId = useAuth().user?.id ?? null;
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => { setAssigneeId(''); }, [assignment]);

  const options = useMemo(
    () => assignableSeats(users, selfId)
      .filter((seat) => seat.categoryId === assignment?.categoryId && seat.user.id !== assignment?.assignedToId)
      .map((seat) => seatOption(seat, seat.user.id, categoryName)),
    [users, selfId, assignment, categoryName],
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
