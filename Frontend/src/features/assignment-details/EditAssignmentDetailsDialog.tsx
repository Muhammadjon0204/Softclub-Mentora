import { PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { Notice } from '../../shared/ui/DetailBlocks';
import { FormField, FormInput, FormTextarea } from '../../shared/ui/FormField';

/** Те же пределы, что у сервера (`Assignment.TitleMinLength/TitleMaxLength/DescriptionMaxLength`). */
const TITLE_MIN = 3;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

export interface EditAssignmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | null;
  /** Вызывающий показывает тост. Диалог закрывается только при успехе, иначе введённое не пропадёт. */
  onConfirm: (title: string, description: string | null) => Promise<void>;
}

/**
 * Исправление текста уже выданного задания: опечатка в названии, забытая ссылка в описании. Срок здесь
 * не меняется — для него «Изменить срок» с причиной. После первой сдачи сервер править не даст.
 */
export function EditAssignmentDetailsDialog({ open, onOpenChange, title, description, onConfirm }: EditAssignmentDetailsDialogProps): JSX.Element {
  const [nextTitle, setNextTitle] = useState('');
  const [nextDescription, setNextDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNextTitle(title);
    setNextDescription(description ?? '');
  }, [open, title, description]);

  const trimmedTitle = nextTitle.trim();
  const trimmedDescription = nextDescription.trim();
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX;
  const changed = trimmedTitle !== title.trim() || trimmedDescription !== (description ?? '').trim();
  const canSave = titleValid && changed && !busy;

  async function handleSave(): Promise<void> {
    if (!canSave) return;
    setBusy(true);
    try {
      await onConfirm(trimmedTitle, trimmedDescription.length > 0 ? trimmedDescription : null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Редактировать задание"
      description="Исправьте название или описание"
      preventClose={busy}
      icon={<PenLine className="h-5 w-5" aria-hidden="true" />}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { onOpenChange(false); }}>Отмена</Button>
          <Button variant="primary" isLoading={busy} disabled={!canSave} onClick={() => { void handleSave(); }}>Сохранить изменения</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Название"
          htmlFor="edit-details-title"
          required
          error={trimmedTitle.length > 0 && !titleValid ? `От ${String(TITLE_MIN)} до ${String(TITLE_MAX)} символов` : undefined}
        >
          <FormInput
            id="edit-details-title"
            value={nextTitle}
            maxLength={TITLE_MAX}
            onChange={(event) => { setNextTitle(event.target.value); }}
          />
        </FormField>

        <FormField label="Описание" htmlFor="edit-details-description">
          <FormTextarea
            id="edit-details-description"
            value={nextDescription}
            maxLength={DESCRIPTION_MAX}
            rows={6}
            onChange={(event) => { setNextDescription(event.target.value); }}
          />
        </FormField>

        <Notice tone="info" icon={PenLine} title="Исполнитель получит уведомление">
          Правка останется в истории задания. После первой сдачи работы текст изменить будет нельзя.
        </Notice>
      </div>
    </Modal>
  );
}
