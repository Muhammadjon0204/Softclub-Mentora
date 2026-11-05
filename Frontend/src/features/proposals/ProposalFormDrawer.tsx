import { useEffect, useState } from 'react';

import type { ProposalDto, ProposalKind } from '../../api/proposals';
import { Drawer, useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { DatePicker } from '../../shared/ui/DatePicker';
import { FormField, FormInput, FormTextarea } from '../../shared/ui/FormField';
import { todayKey } from '../../lib/dayKeys';
import { localInputToUtcMs, toDateInputValue } from '../lead/scope/leadDateFormat';
import { PROPOSAL_KIND, PROPOSAL_KINDS } from './proposalPresentation';
import { useProposalActions } from './useProposals';

const TITLE_MIN = 3;
const TITLE_MAX = 200;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;

/** Дата здесь — пожелание, а не срок: полдень не даёт ей съехать на соседний день при смене пояса. */
const PREFERRED_TIME = '12:00';

export interface ProposalFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Заполнено при редактировании; пусто при новом предложении. */
  proposal: ProposalDto | null;
  timeZoneId: string;
}

export function ProposalFormDrawer({ open, onClose, proposal, timeZoneId }: ProposalFormDrawerProps): JSX.Element {
  const toast = useToast();
  const actions = useProposalActions();
  const [kind, setKind] = useState<ProposalKind>('MasterClass');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(proposal?.kind ?? 'MasterClass');
    setTitle(proposal?.title ?? '');
    setDescription(proposal?.description ?? '');
    setPreferredDate(proposal?.preferredAt ? toDateInputValue(Date.parse(proposal.preferredAt), timeZoneId) : '');
    setTouched(false);
  }, [open, proposal, timeZoneId]);

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;
  const titleError = titleLength < TITLE_MIN ? `Не менее ${String(TITLE_MIN)} символов` : undefined;
  const descriptionError = descriptionLength < DESCRIPTION_MIN ? `Опишите идею подробнее: не менее ${String(DESCRIPTION_MIN)} символов` : undefined;
  const valid = titleError === undefined && descriptionError === undefined;

  async function handleSubmit(): Promise<void> {
    setTouched(true);
    if (!valid) return;

    const preferredMs = preferredDate.length > 0 ? localInputToUtcMs(preferredDate, PREFERRED_TIME, timeZoneId) : null;
    const draft = {
      kind,
      title: title.trim(),
      description: description.trim(),
      preferredAt: preferredMs !== null ? new Date(preferredMs).toISOString() : null,
    };

    try {
      if (proposal === null) {
        await actions.create(draft);
        toast.success('Предложение отправлено');
      } else {
        await actions.update(proposal.id, draft, proposal.concurrencyToken);
        toast.success('Предложение обновлено');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить предложение');
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={proposal === null ? 'Новое предложение' : 'Изменить предложение'}
      description="Тимлид направления посмотрит идею и примет решение. Если примет, она появится у вас как задание."
      preventClose={actions.isSubmitting}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={actions.isSubmitting} onClick={onClose}>Отмена</Button>
          <Button variant="primary" isLoading={actions.isSubmitting} onClick={() => { void handleSubmit(); }}>
            {proposal === null ? 'Отправить предложение' : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-secondary">Что вы предлагаете</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Вид предложения">
            {PROPOSAL_KINDS.map((option) => {
              const { label, icon: Icon } = PROPOSAL_KIND[option];
              const active = option === kind;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => { setKind(option); }}
                  className={`flex items-center gap-2 rounded-control border px-3 py-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active ? 'border-brand bg-brand-soft text-brand-active' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormField label="Название" htmlFor="proposal-title" required error={touched ? titleError : undefined}>
          <FormInput
            id="proposal-title"
            value={title}
            maxLength={TITLE_MAX}
            invalid={touched && titleError !== undefined}
            placeholder="Например: мастер-класс по работе с Git"
            onChange={(event) => { setTitle(event.target.value); }}
          />
        </FormField>

        <FormField
          label="Описание"
          htmlFor="proposal-description"
          required
          error={touched ? descriptionError : undefined}
          hint="Для кого это, что получат участники и что вам понадобится"
        >
          <FormTextarea
            id="proposal-description"
            value={description}
            maxLength={DESCRIPTION_MAX}
            rows={6}
            invalid={touched && descriptionError !== undefined}
            onChange={(event) => { setDescription(event.target.value); }}
          />
        </FormField>

        <FormField label="Когда хотели бы провести" htmlFor="proposal-date" hint="Необязательно. Точный срок назначит тот, кто примет решение">
          <DatePicker id="proposal-date" value={preferredDate} onChange={setPreferredDate} min={todayKey()} clearable />
        </FormField>
      </div>
    </Drawer>
  );
}
