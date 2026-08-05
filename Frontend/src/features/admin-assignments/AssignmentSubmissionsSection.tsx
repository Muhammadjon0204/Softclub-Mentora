import { FileText, Inbox } from 'lucide-react';

import { EmptyState } from '../../shared/ui/EmptyState';
import type { SubmissionEntry, SubmissionFile } from './assignmentPresentation';

export interface AssignmentSubmissionsSectionProps {
  submissions: SubmissionEntry[];
  onOpenFile: (file: SubmissionFile) => void;
}

/** Immutable submissions — просмотр, не редактирование (раздел 16 промпта). */
export function AssignmentSubmissionsSection({ submissions, onOpenFile }: AssignmentSubmissionsSectionProps): JSX.Element {
  if (submissions.length === 0) {
    return <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden="true" />} title="Решений пока нет" description="Ментор ещё не отправил ни одной версии решения." />;
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <div key={submission.id} className="rounded-control border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-semibold text-ink">Попытка {submission.versionNumber}</span>
            <span className="text-[12px] text-ink-muted">{submission.submittedAtLabel}{submission.late ? ' · с опозданием' : ''}</span>
          </div>
          {submission.comment !== null ? <p className="mt-2 whitespace-pre-line text-[13px] leading-[20px] text-ink-secondary">{submission.comment}</p> : null}
          <ul className="mt-3 space-y-2">
            {submission.files.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => { onOpenFile(file); }}
                  aria-label={`Открыть файл ${file.name}, ${file.extension.toUpperCase()}, ${file.sizeLabel}`}
                  className="flex w-full items-center gap-2.5 rounded-control-sm border border-line bg-surface-muted px-3 py-2 text-left transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <FileText className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{file.name}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-muted">{file.sizeLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
