import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { issueAssignment, publishAssignment, updateDraft } from '@/api/assignments';
import { getAssignment, type Assignment } from '@/features/assignments/api';
import { seatKey, useAssignees } from '@/features/assignments/people';
import { useT } from '@/lib/i18n';
import { goBack } from '@/lib/nav';
import { useColors } from '@/lib/useColors';
import { DateTimeField } from '@/ui/date';
import { useAction } from '@/ui/feedback';
import { Button } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Select } from '@/ui/sheet';

/** Giving out work, and finishing a draft (`?draft=<id>`). */
export default function NewAssignmentScreen(): JSX.Element {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const query = useQuery({ queryKey: ['assignment', draft], queryFn: () => getAssignment(draft as string), enabled: Boolean(draft) });
  if (!draft) return <Form />;
  return (
    <Page>
      <Loaded query={query}>{(assignment) => <Form draft={assignment} embedded />}</Loaded>
    </Page>
  );
}

function Form({ draft, embedded = false }: { draft?: Assignment; embedded?: boolean }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const people = useAssignees();
  // A person and a team together: somebody in two teams is listed in each.
  const [assignee, setAssignee] = useState<string | null>(draft ? seatKey(draft.assignedToId, draft.categoryId) : null);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [due, setDue] = useState<Date | null>(draft ? new Date(draft.currentDueAt) : null);
  const [openedAt] = useState(() => Date.now());
  const valid = assignee !== null && title.trim().length >= 3 && due !== null && due.getTime() > openedAt;

  const save = useAction(
    async (publish: boolean) => {
      const seat = assignee ? people.byKey.get(assignee) : undefined;
      if (!seat || !due) return;
      const input = { assignedToId: seat.user.id, title: title.trim(), description: description.trim() || null, dueAt: due.toISOString() };
      if (draft) {
        const updated = (await updateDraft(draft, input)) as Assignment;
        if (publish) await publishAssignment(updated);
      } else {
        await issueAssignment({ ...input, categoryId: seat.categoryId }, seat.user.branchId ?? null, publish);
      }
    },
    { success: 'Сохранено', onDone: () => goBack('/assignments') },
  );

  const body = (
    <>
      <Select
        label={t('Кому')}
        value={assignee}
        onChange={setAssignee}
        // A draft stays in its team; only who does it can change.
        options={draft ? people.options.filter((o) => people.byKey.get(o.value)?.categoryId === draft.categoryId) : people.options}
        placeholder={people.loading ? t('Загрузка…') : t('Выберите человека и команду')}
      />
      <Field label={t('Название')} value={title} onChangeText={setTitle} maxLength={200} placeholder={t('Что нужно сделать')} />
      <Field label={t('Описание')} value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder={t('Что считается готовым результатом')} />
      <DateTimeField label={t('Срок сдачи')} value={due} onChange={setDue} />
      {due !== null && due.getTime() <= openedAt ? <Text style={{ color: c.danger, fontSize: 13 }}>{t('Срок должен быть в будущем')}</Text> : null}
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Проверять работу и вести задание будете вы: тот, кто его выдал.')}</Text>
      <Button label={t('Выдать задание')} onPress={() => save.run(true)} disabled={!valid} loading={save.busy} />
      <Button kind="secondary" label={t('Сохранить черновик')} onPress={() => save.run(false)} disabled={!valid || save.busy} />
    </>
  );
  return embedded ? body : <Page>{body}</Page>;
}
