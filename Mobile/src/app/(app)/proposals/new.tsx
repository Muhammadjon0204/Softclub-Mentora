import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { createProposal, getProposal, updateProposal, type Proposal, type ProposalKind } from '@/api/work';
import { PROPOSAL_KIND } from '@/features/proposals/presentation';
import { useT } from '@/lib/i18n';
import { goBack } from '@/lib/nav';
import { DateTimeField } from '@/ui/date';
import { useAction } from '@/ui/feedback';
import { Button } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Select } from '@/ui/sheet';

/** A mentor puts forward an idea, or edits one still waiting (`?id=`). */
export default function ProposalFormScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const query = useQuery({ queryKey: ['proposal', id], queryFn: () => getProposal(id as string), enabled: Boolean(id) });
  return <Page>{id ? <Loaded query={query}>{(p) => <Form proposal={p} />}</Loaded> : <Form />}</Page>;
}

function Form({ proposal }: { proposal?: Proposal }): JSX.Element {
  const { t } = useT();
  const [kind, setKind] = useState<ProposalKind>(proposal?.kind ?? 'MasterClass');
  const [title, setTitle] = useState(proposal?.title ?? '');
  const [description, setDescription] = useState(proposal?.description ?? '');
  const [when, setWhen] = useState<Date | null>(proposal?.preferredAt ? new Date(proposal.preferredAt) : null);
  const input = { kind, title: title.trim(), description: description.trim(), preferredAt: when ? when.toISOString() : null };
  const save = useAction(() => (proposal ? updateProposal(proposal, input) : createProposal(input)), {
    success: proposal ? 'Сохранено' : 'Предложение отправлено',
    onDone: () => goBack('/proposals'),
  });
  return (
    <>
      <Select label={t('Вид')} value={kind} onChange={setKind} options={(Object.keys(PROPOSAL_KIND) as ProposalKind[]).map((k) => ({ value: k, label: t(PROPOSAL_KIND[k].label) }))} />
      <Field label={t('Название')} value={title} onChangeText={setTitle} maxLength={200} />
      <Field label={t('Описание')} value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder={t('Не меньше 10 символов')} />
      <DateTimeField label={t('Когда хотелось бы (необязательно)')} value={when} onChange={setWhen} />
      <Button label={t(proposal ? 'Сохранить изменения' : 'Отправить')} onPress={() => save.run()} loading={save.busy} disabled={input.title.length < 3 || input.description.length < 10} />
    </>
  );
}
