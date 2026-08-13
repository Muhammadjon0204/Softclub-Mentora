import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../../shared/overlays';
import { FormField, FormSelect } from '../../shared/ui/FormField';
import { scopedActiveMentors } from '../lead/scope/leadScopedData';
import { useLeadScope } from '../lead/scope/useLeadScope';

export interface ReassignAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentTitle: string;
  currentMentorId: string;
  onConfirm: (mentorId: string) => void;
}

/** Переназначение — только активный Mentor той же Category (10.6.3, composite FK). */
export function ReassignAssignmentDialog({ open, onOpenChange, assignmentTitle, currentMentorId, onConfirm }: ReassignAssignmentDialogProps): JSX.Element {
  const scope = useLeadScope();
  const mentors = scopedActiveMentors(scope.categoryId).filter((mentor) => mentor.id !== currentMentorId);
  const [mentorId, setMentorId] = useState('');

  useEffect(() => {
    if (open) setMentorId('');
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Переназначить задание"
      description={<>«{assignmentTitle}» будет переназначено другому ментору вашего направления.</>}
      confirmLabel="Переназначить"
      confirmDisabled={mentorId.length === 0}
      onConfirm={() => { onConfirm(mentorId); }}
      details={
        <FormField label="Новый ментор" htmlFor="reassign-mentor" required hint={mentors.length === 0 ? 'Нет других активных менторов направления' : undefined}>
          <FormSelect id="reassign-mentor" value={mentorId} onChange={(event) => { setMentorId(event.target.value); }}>
            <option value="">Выберите ментора</option>
            {mentors.map((mentor) => (
              <option key={mentor.id} value={mentor.id}>{mentor.fullName}</option>
            ))}
          </FormSelect>
        </FormField>
      }
    />
  );
}
