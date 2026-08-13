import { useEffect, useState } from 'react';

import { Drawer, UnsavedChangesDialog } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { LeadAssignmentPreviewError, createDraftPreview, editAssignmentPreview } from '../lead/assignments/leadAssignmentPreviewStore';
import { useLeadScope } from '../lead/scope/useLeadScope';
import { useResolvedLeadAssignment } from '../lead/scope/useScopedLeadAssignments';
import { AssignmentForm } from './AssignmentForm';

export type AssignmentFormDrawerState = { mode: 'create' } | { mode: 'edit'; assignmentId: string };

const FORM_ID = 'lead-assignment-form-drawer';

export interface AssignmentFormDrawerProps {
  state: AssignmentFormDrawerState | null;
  onClose: () => void;
}

/** ASN-001 (создание Draft) + ASN-004 (редактирование Draft/Suggested) в одном Drawer, как `UserFormDrawer` у Admin. */
export function AssignmentFormDrawer({ state, onClose }: AssignmentFormDrawerProps): JSX.Element {
  const scope = useLeadScope();
  const editingAssignment = useResolvedLeadAssignment(state?.mode === 'edit' ? state.assignmentId : null);

  const [dirty, setDirty] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDirty(false);
    setBannerError(null);
    setUnsavedOpen(false);
  }, [state]);

  const open = state !== null;

  function requestClose(): void {
    if (submitting) return;
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    onClose();
  }

  function handleSubmit(values: { title: string; description: string; mentorId: string; dueAtMs: number; topicAssignmentId: string | null }): void {
    setBannerError(null);
    setSubmitting(true);
    try {
      if (state?.mode === 'edit' && editingAssignment !== undefined) {
        editAssignmentPreview(scope.categoryId, editingAssignment.id, {
          title: values.title,
          description: values.description,
          mentorId: values.mentorId,
          dueAt: values.dueAtMs,
        });
      } else {
        createDraftPreview({
          categoryId: scope.categoryId,
          title: values.title,
          description: values.description,
          mentorId: values.mentorId,
          dueAt: values.dueAtMs,
          leadName: scope.leadName,
        });
      }
      setDirty(false);
      onClose();
    } catch (error) {
      setBannerError(error instanceof LeadAssignmentPreviewError ? error.message : 'Не удалось сохранить задание. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = state?.mode === 'edit';

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        title={isEdit ? 'Редактировать задание' : 'Новое задание'}
        description={isEdit ? undefined : `${scope.categoryName} · ${scope.branchDisplayName}`}
        size="lg"
        preventClose={submitting}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" disabled={submitting} onClick={requestClose}>
              Отмена
            </Button>
            <Button type="submit" form={FORM_ID} variant="primary" isLoading={submitting}>
              {isEdit ? 'Сохранить изменения' : 'Создать черновик'}
            </Button>
          </div>
        }
      >
        {open && (!isEdit || editingAssignment !== undefined) ? (
          <AssignmentForm formId={FORM_ID} existing={isEdit ? editingAssignment : undefined} bannerError={bannerError} onDirtyChange={setDirty} onSubmit={handleSubmit} />
        ) : null}
      </Drawer>

      <UnsavedChangesDialog
        open={unsavedOpen}
        onStay={() => { setUnsavedOpen(false); }}
        onDiscard={() => {
          setUnsavedOpen(false);
          setDirty(false);
          onClose();
        }}
      />
    </>
  );
}
