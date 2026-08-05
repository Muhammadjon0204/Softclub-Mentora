import { useEffect, useState } from 'react';

import { Drawer } from '../../shared/overlays';
import { ErrorState } from '../../shared/ui/ErrorState';
import { AssignmentHistorySection } from './AssignmentHistorySection';
import { AssignmentNotificationsSection } from './AssignmentNotificationsSection';
import { AssignmentOverviewSection, ASSIGNMENT_STATUS_META } from './AssignmentOverviewSection';
import { AssignmentReviewSection } from './AssignmentReviewSection';
import { AssignmentSubmissionsSection } from './AssignmentSubmissionsSection';
import { DeadlineHistoryModal } from './DeadlineHistoryModal';
import { FileDetailsModal } from './FileDetailsModal';
import { FilePreviewModal } from './FilePreviewModal';
import type { PreviewAssignmentDetails, SubmissionFile } from './assignmentPresentation';
import { ASSIGNMENT_STATUS_LABEL } from '../../mocks/ui-preview/assignments.preview';

type AssignmentDetailsTab = 'overview' | 'submissions' | 'review' | 'history' | 'notifications';

const TABS: { id: AssignmentDetailsTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'submissions', label: 'Решения' },
  { id: 'review', label: 'Проверка' },
  { id: 'history', label: 'История' },
  { id: 'notifications', label: 'Уведомления' },
];

export interface AssignmentDetailsDrawerProps {
  assignment: PreviewAssignmentDetails | undefined;
  assignmentId: string | null;
  onClose: () => void;
}

/**
 * Admin здесь только наблюдает (раздел 13 промпта) — никаких кнопок Lead/Mentor
 * (Одобрить/На доработку/Назначить/...). Только просмотр: submissions, review,
 * timeline, уведомления, файлы.
 */
export function AssignmentDetailsDrawer({ assignment, assignmentId, onClose }: AssignmentDetailsDrawerProps): JSX.Element {
  const [tab, setTab] = useState<AssignmentDetailsTab>('overview');
  const [previewFile, setPreviewFile] = useState<SubmissionFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<SubmissionFile | null>(null);
  const [deadlineHistoryOpen, setDeadlineHistoryOpen] = useState(false);

  useEffect(() => {
    if (assignmentId !== null) setTab('overview');
  }, [assignmentId]);

  const open = assignmentId !== null;
  const statusMeta = assignment !== undefined ? ASSIGNMENT_STATUS_META[assignment.status] : null;

  function handleOpenFile(file: SubmissionFile): void {
    if (file.extension === 'pdf') setPreviewFile(file);
    else setDetailsFile(file);
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={assignment?.title ?? 'Задание'}
        description={assignment !== undefined ? `${assignment.mentorName} · ${assignment.categoryName}` : undefined}
        size="lg"
        headerActions={
          assignment !== undefined && statusMeta !== null ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium"
              role="status"
              aria-label={`Статус: ${ASSIGNMENT_STATUS_LABEL[assignment.status]}`}
            >
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${statusMeta.dot}`} />
              <span className={statusMeta.text}>{ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
            </span>
          ) : undefined
        }
      >
        {assignmentId === null ? null : assignment === undefined ? (
          <ErrorState title="Задание не найдено" error={null} />
        ) : (
          <div className="space-y-5">
            <div role="tablist" aria-label="Разделы задания" className="flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => { setTab(item.id); }}
                  className={`h-8 shrink-0 rounded-control-sm px-2.5 text-[12.5px] font-medium transition ${tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === 'overview' ? <AssignmentOverviewSection assignment={assignment} onOpenDeadlineHistory={() => { setDeadlineHistoryOpen(true); }} /> : null}
              {tab === 'submissions' ? <AssignmentSubmissionsSection submissions={assignment.submissions} onOpenFile={handleOpenFile} /> : null}
              {tab === 'review' ? <AssignmentReviewSection review={assignment.review} /> : null}
              {tab === 'history' ? <AssignmentHistorySection events={assignment.events} /> : null}
              {tab === 'notifications' ? <AssignmentNotificationsSection notifications={assignment.notifications} /> : null}
            </div>
          </div>
        )}
      </Drawer>

      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(next) => { if (!next) setPreviewFile(null); }} />
      <FileDetailsModal file={detailsFile} open={detailsFile !== null} onOpenChange={(next) => { if (!next) setDetailsFile(null); }} />
      <DeadlineHistoryModal entries={assignment?.deadlineHistory ?? []} open={deadlineHistoryOpen} onOpenChange={setDeadlineHistoryOpen} />
    </>
  );
}
