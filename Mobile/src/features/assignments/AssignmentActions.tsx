import { router } from 'expo-router';
import { Ban, CalendarClock, PencilLine, Send, UserRoundCog } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { acceptSuggestion, cancelAssignment, editDetails, publishAssignment, reassign, reschedule } from '@/api/assignments';
import { Space } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { DateTimeField } from '@/ui/date';
import { useAction, useConfirm } from '@/ui/feedback';
import { Button, Group, Row, Section } from '@/ui/kit';
import { Field } from '@/ui/primitives';
import { Select, Sheet } from '@/ui/sheet';

import type { Assignment } from './api';
import { useAssignees } from './people';
import { useCan } from './queries';

type Panel = 'edit' | 'deadline' | 'reassign' | 'cancel' | null;

/**
 * What can be done with a task right now, by status, by who issued it and by what the owner has left
 * open — the same rules as the site; the server checks them again.
 */
export function AssignmentActions({ assignment: a }: { assignment: Assignment }): JSX.Element | null {
  const { t } = useT();
  const user = useUser();
  const can = useCan();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<Panel>(null);
  const publish = useAction(() => publishAssignment(a), { success: 'Задание выдано' });
  const accept = useAction(() => acceptSuggestion(a), { success: 'Предложение принято' });

  const owns = a.canManage === true;
  const draft = a.status === 'Draft';
  const suggested = a.status === 'Suggested';
  const closed = a.status === 'Approved' || a.status === 'Cancelled';
  const nothingHandedIn = !a.firstSubmittedAt;

  const mayPublish = owns && draft && can('assignments.assign');
  const mayAccept = owns && suggested && user.role === 'Lead' && can('assignments.assign');
  const mayEditDraft = owns && (draft || suggested) && can('assignments.assign');
  const mayEditText = owns && (a.status === 'Assigned' || a.status === 'Overdue') && nothingHandedIn && can('assignments.assign');
  const mayMove = owns && ['Assigned', 'NeedsRework', 'Overdue'].includes(a.status) && can('assignments.reschedule');
  const mayReassign = owns && ['Draft', 'Suggested', 'Assigned'].includes(a.status) && nothingHandedIn && can('assignments.reassign');
  // A superior may stop work they did not issue; nobody may reopen finished work.
  const mayCancel = !closed && (owns || user.role === 'Admin') && can('assignments.cancel');

  if (!(mayPublish || mayAccept || mayEditDraft || mayEditText || mayMove || mayReassign || mayCancel)) return null;

  return (
    <View style={{ gap: Space.md }}>
      {mayPublish ? (
        <Button
          label={t('Выдать задание')}
          icon={Send}
          loading={publish.busy}
          onPress={() => confirm(t('Выдать задание?'), t('Исполнитель получит уведомление.'), t('Выдать'), () => publish.run())}
        />
      ) : null}
      {mayAccept ? <Button label={t('Принять предложение')} loading={accept.busy} onPress={() => accept.run()} /> : null}

      <Section title={t('Действия')}>
        <Group>
          {mayEditDraft ? <Row title={t('Редактировать черновик')} icon={PencilLine} onPress={() => router.push({ pathname: '/assignment/new', params: { draft: a.id } })} /> : null}
          {mayEditText ? <Row title={t('Исправить название или описание')} icon={PencilLine} onPress={() => setPanel('edit')} /> : null}
          {mayMove ? <Row title={t('Изменить срок')} icon={CalendarClock} onPress={() => setPanel('deadline')} /> : null}
          {mayReassign ? <Row title={t('Переназначить')} icon={UserRoundCog} onPress={() => setPanel('reassign')} /> : null}
          {mayCancel ? <Row title={t('Отменить задание')} icon={Ban} iconTone="danger" danger onPress={() => setPanel('cancel')} /> : null}
        </Group>
      </Section>

      {panel === 'edit' ? <EditPanel assignment={a} onClose={() => setPanel(null)} /> : null}
      {panel === 'deadline' ? <DeadlinePanel assignment={a} onClose={() => setPanel(null)} /> : null}
      {panel === 'reassign' ? <ReassignPanel assignment={a} onClose={() => setPanel(null)} /> : null}
      {panel === 'cancel' ? <CancelPanel assignment={a} onClose={() => setPanel(null)} /> : null}
    </View>
  );
}

interface PanelProps {
  assignment: Assignment;
  onClose: () => void;
}

function EditPanel({ assignment, onClose }: PanelProps): JSX.Element {
  const { t } = useT();
  const c = useColors();
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? '');
  const save = useAction(() => editDetails(assignment, title.trim(), description.trim() || null), {
    success: 'Задание исправлено, исполнитель получит уведомление',
    onDone: onClose,
  });
  const changed = title.trim() !== assignment.title || description.trim() !== (assignment.description ?? '');
  return (
    <Sheet open onClose={onClose} title={t('Редактировать задание')}>
      <Field label={t('Название')} value={title} onChangeText={setTitle} maxLength={200} />
      <Field label={t('Описание')} value={description} onChangeText={setDescription} multiline maxLength={2000} />
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Правка останется в истории задания. После первой сдачи работы текст изменить будет нельзя.')}</Text>
      <Button label={t('Сохранить изменения')} onPress={() => save.run()} loading={save.busy} disabled={title.trim().length < 3 || !changed} />
    </Sheet>
  );
}

function DeadlinePanel({ assignment, onClose }: PanelProps): JSX.Element {
  const { t } = useT();
  const [due, setDue] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [openedAt] = useState(() => Date.now());
  const save = useAction(() => reschedule(assignment, (due as Date).toISOString(), reason.trim()), {
    success: 'Срок изменён, исполнитель получит уведомление',
    onDone: onClose,
  });
  const valid = due !== null && due.getTime() > openedAt && reason.trim().length >= 5;
  return (
    <Sheet open onClose={onClose} title={t('Изменить срок')}>
      <DateTimeField label={t('Новый срок')} value={due} onChange={setDue} />
      <Field label={t('Причина')} value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t('Исполнитель увидит её в уведомлении и в истории задания')} />
      <Button label={t('Изменить срок')} onPress={() => save.run()} loading={save.busy} disabled={!valid} />
    </Sheet>
  );
}

function ReassignPanel({ assignment, onClose }: PanelProps): JSX.Element {
  const { t } = useT();
  const people = useAssignees();
  const [assignee, setAssignee] = useState<string | null>(null);
  const save = useAction(() => reassign(assignment, assignee as string), { success: 'Исполнитель изменён', onDone: onClose });
  // The work stays in its team: only its other members can take it over.
  const options = people.options.flatMap((o) => {
    const seat = people.byKey.get(o.value);
    return seat && seat.categoryId === assignment.categoryId && seat.user.id !== assignment.assignedToId
      ? [{ ...o, value: seat.user.id }]
      : [];
  });
  return (
    <Sheet open onClose={onClose} title={t('Переназначить')}>
      <Select label={t('Новый исполнитель')} value={assignee} onChange={setAssignee} options={options} />
      <Button label={t('Переназначить')} onPress={() => save.run()} loading={save.busy} disabled={!assignee} />
    </Sheet>
  );
}

function CancelPanel({ assignment, onClose }: PanelProps): JSX.Element {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const save = useAction(() => cancelAssignment(assignment, reason.trim()), { success: 'Задание отменено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Отменить задание')}>
      <Field label={t('Причина отмены')} value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t('Не меньше 5 символов')} />
      <Button kind="danger" label={t('Отменить задание')} onPress={() => save.run()} loading={save.busy} disabled={reason.trim().length < 5} />
    </Sheet>
  );
}
