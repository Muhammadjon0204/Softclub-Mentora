import { useEffect, useMemo, useState } from 'react';

import type { UserDto } from '../../api/admin/users';
import { Drawer, useToast } from '../../shared/overlays';
import { SearchSelect } from '../../shared/select';
import { Button } from '../../shared/ui/Button';
import { DatePicker } from '../../shared/ui/DatePicker';
import { FormField, FormInput, FormTextarea } from '../../shared/ui/FormField';
import { TimePicker } from '../../shared/ui/TimePicker';
import { todayKey } from '../../lib/dayKeys';
import { localInputToUtcMs } from '../lead/scope/leadDateFormat';
import { useCategoryTimeZone } from '../proposals/useProposals';
import { assignablePeople, personOption } from './assignablePeople';
import type { AdminAssignmentActions } from './useAdminAssignmentActions';

const TITLE_MIN = 3;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const DEFAULT_DUE_TIME = '23:59';

export interface AdminAssignmentFormDrawerProps {
  open: boolean;
  onClose: () => void;
  users: UserDto[];
  categoryName: (categoryId: string) => string | undefined;
  actions: AdminAssignmentActions;
  onAssigned: (assignmentId: string) => void;
}

/**
 * Задание от администратора. Филиал и направление не спрашиваются: они берутся у человека, поэтому
 * форма начинается с него и ошибиться контуром нельзя. Сразу после сохранения задание опубликовано:
 * черновики у администратора некому и незачем дорабатывать.
 */
export function AdminAssignmentFormDrawer({ open, onClose, users, categoryName, actions, onAssigned }: AdminAssignmentFormDrawerProps): JSX.Element {
  const toast = useToast();
  const [assigneeId, setAssigneeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(DEFAULT_DUE_TIME);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssigneeId('');
    setTitle('');
    setDescription('');
    setDate('');
    setTime(DEFAULT_DUE_TIME);
    setTouched(false);
  }, [open]);

  const people = useMemo(() => assignablePeople(users), [users]);
  const options = useMemo(
    () => people.map((user) => personOption(user, user.categoryId !== null ? categoryName(user.categoryId) : undefined)),
    [people, categoryName],
  );

  const assignee = people.find((user) => user.id === assigneeId) ?? null;
  const timeZoneId = useCategoryTimeZone(assignee?.categoryId ?? null);
  const dueMs = date.length > 0 ? localInputToUtcMs(date, time, timeZoneId) : null;

  const assigneeError = assignee === null ? 'Выберите исполнителя' : undefined;
  const titleError = title.trim().length < TITLE_MIN ? `Не менее ${String(TITLE_MIN)} символов` : undefined;
  const dueError = dueMs === null ? 'Укажите срок' : dueMs <= Date.now() ? 'Срок должен быть в будущем' : undefined;

  async function handleSubmit(): Promise<void> {
    setTouched(true);
    if (assignee === null || titleError !== undefined || dueError !== undefined || dueMs === null) return;

    try {
      const created = await actions.assign({
        assignedToId: assignee.id,
        title: title.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        dueAtMs: dueMs,
      });
      toast.success(`Задание выдано: ${assignee.fullName}`);
      onAssigned(created.id);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось выдать задание');
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Новое задание"
      description="Проверять работу и вести задание будете вы: тот, кто его выдал."
      preventClose={actions.isSubmitting}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={actions.isSubmitting} onClick={onClose}>Отмена</Button>
          <Button variant="primary" isLoading={actions.isSubmitting} onClick={() => { void handleSubmit(); }}>Выдать задание</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormField label="Кому" htmlFor="admin-assign-person" required error={touched ? assigneeError : undefined}>
          <SearchSelect
            id="admin-assign-person"
            value={assigneeId}
            onValueChange={setAssigneeId}
            options={options}
            placeholder="Выберите тимлида или ментора"
            searchPlaceholder="Поиск по имени"
            emptyMessage="Никого не нашли"
            invalid={touched && assigneeError !== undefined}
          />
        </FormField>

        <FormField label="Название" htmlFor="admin-assign-title" required error={touched ? titleError : undefined}>
          <FormInput id="admin-assign-title" value={title} maxLength={TITLE_MAX} invalid={touched && titleError !== undefined} onChange={(event) => { setTitle(event.target.value); }} />
        </FormField>

        <FormField label="Описание" htmlFor="admin-assign-description" hint="Что нужно сделать и что считается готовым результатом">
          <FormTextarea id="admin-assign-description" rows={5} maxLength={DESCRIPTION_MAX} value={description} onChange={(event) => { setDescription(event.target.value); }} />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <FormField
            label="Срок"
            htmlFor="admin-assign-date"
            required
            error={touched ? dueError : undefined}
            hint={assignee !== null ? `Часовой пояс: ${timeZoneId}` : 'Часовой пояс возьмём из направления исполнителя'}
          >
            <DatePicker id="admin-assign-date" value={date} onChange={setDate} min={todayKey()} invalid={touched && dueError !== undefined} />
          </FormField>
          <FormField label="Время" htmlFor="admin-assign-time" required>
            <TimePicker id="admin-assign-time" value={time} onChange={setTime} />
          </FormField>
        </div>
      </div>
    </Drawer>
  );
}
