import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { approveProposal, getProposal, rejectProposal, withdrawProposal, type Proposal } from '@/api/work';
import { Space } from '@/constants/theme';
import { useCan } from '@/features/assignments/queries';
import { PROPOSAL_KIND, PROPOSAL_STATUS } from '@/features/proposals/presentation';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { DateTimeField } from '@/ui/date';
import { useAction, useConfirm } from '@/ui/feedback';
import { Badge, Button, Group, Info, Section } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Sheet } from '@/ui/sheet';

export default function ProposalScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['proposal', id], queryFn: () => getProposal(id) });
  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>{(p) => <Details proposal={p} />}</Loaded>
    </Page>
  );
}

function Details({ proposal: p }: { proposal: Proposal }): JSX.Element {
  const c = useColors();
  const { t, locale } = useT();
  const me = useUser();
  const can = useCan();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<'approve' | 'reject' | null>(null);
  const withdraw = useAction(() => withdrawProposal(p), { success: 'Предложение отозвано' });
  const mine = p.authorId === me.id && p.status === 'Pending';
  const decide = p.canDecide && p.status === 'Pending' && can('proposals.decide');
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <View style={{ gap: Space.sm }}>
        <Badge label={t(PROPOSAL_STATUS[p.status].label)} tone={PROPOSAL_STATUS[p.status].tone} />
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', lineHeight: 28 }}>{p.title}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 16, lineHeight: 24 }} selectable>{p.description}</Text>
      </View>
      <Group>
        <Info label={t('Вид')} value={t(PROPOSAL_KIND[p.kind].label)} />
        <Info label={t('Автор')} value={p.authorFullName} />
        <Info label={t('Направление')} value={p.categoryName} />
        <Info label={t('Отправлено')} value={when(p.createdAt)} />
        {p.preferredAt ? <Info label={t('Желаемое время')} value={when(p.preferredAt)} /> : null}
      </Group>
      {p.decidedAt ? (
        <Section title={t('Решение')}>
          <Group>
            <Info label={t('Кто решил')} value={p.decidedByFullName ?? '—'} />
            <Info label={t('Когда')} value={when(p.decidedAt)} />
            {p.decisionComment ? <Info label={t('Комментарий')} value={p.decisionComment} /> : null}
          </Group>
        </Section>
      ) : null}
      {p.assignmentId ? <Button kind="secondary" label={t('Открыть задание')} onPress={() => router.push({ pathname: '/assignment/[id]', params: { id: p.assignmentId as string } })} /> : null}
      {decide ? (
        <>
          <Button label={t('Принять предложение')} onPress={() => setPanel('approve')} />
          <Button kind="danger" label={t('Отклонить')} onPress={() => setPanel('reject')} />
        </>
      ) : null}
      {mine ? (
        <>
          <Button kind="secondary" label={t('Редактировать')} onPress={() => router.push({ pathname: '/proposals/new', params: { id: p.id } })} />
          <Button kind="danger" label={t('Отозвать')} loading={withdraw.busy} onPress={() => confirm(t('Отозвать предложение?'), t('Его больше нельзя будет рассмотреть.'), t('Отозвать'), () => withdraw.run(), true)} />
        </>
      ) : null}
      {panel === 'approve' ? <ApprovePanel proposal={p} onClose={() => setPanel(null)} /> : null}
      {panel === 'reject' ? <RejectPanel proposal={p} onClose={() => setPanel(null)} /> : null}
    </>
  );
}

function ApprovePanel({ proposal, onClose }: { proposal: Proposal; onClose: () => void }): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const [due, setDue] = useState<Date | null>(proposal.preferredAt ? new Date(proposal.preferredAt) : null);
  const [comment, setComment] = useState('');
  const [openedAt] = useState(() => Date.now());
  const save = useAction(() => approveProposal(proposal, (due as Date).toISOString(), comment.trim() || null), { success: 'Предложение принято', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Принять предложение')}>
      <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('Предложение станет заданием этого ментора.')}</Text>
      <DateTimeField label={t('Срок сдачи')} value={due} onChange={setDue} />
      <Field label={t('Комментарий (необязательно)')} value={comment} onChangeText={setComment} multiline maxLength={500} />
      <Button label={t('Принять')} onPress={() => save.run()} loading={save.busy} disabled={!due || due.getTime() <= openedAt} />
    </Sheet>
  );
}

function RejectPanel({ proposal, onClose }: { proposal: Proposal; onClose: () => void }): JSX.Element {
  const { t } = useT();
  const [comment, setComment] = useState('');
  const save = useAction(() => rejectProposal(proposal, comment.trim()), { success: 'Предложение отклонено', onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={t('Отклонить предложение')}>
      <Field label={t('Причина')} value={comment} onChangeText={setComment} multiline maxLength={500} placeholder={t('Не меньше 5 символов')} />
      <Button kind="danger" label={t('Отклонить')} onPress={() => save.run()} loading={save.busy} disabled={comment.trim().length < 5} />
    </Sheet>
  );
}
