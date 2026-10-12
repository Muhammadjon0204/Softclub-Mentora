import { AlertTriangle } from 'lucide-react';

import type { LeadSubmissionFile, LeadSubmissionRecord } from '../../mocks/ui-preview/leadAssignments.preview';
import { FileRow, QuoteBlock } from '../../shared/ui/DetailBlocks';

export interface SubmissionVersionCardProps {
  submission: LeadSubmissionRecord;
  isCurrent: boolean;
  /** «Комментарий ментора» у руководителя, «Ваш комментарий» у самого ментора. */
  commentLabel: string;
  formatDate: (ms: number) => string;
  onOpenFile: (file: LeadSubmissionFile, submittedAt: number) => void;
}

/**
 * Одна версия решения: когда сдана, комментарий автора, файлы и решение руководителя по ней.
 * Общая для ментора и руководителя — оба видят одну и ту же историю одинаково.
 */
export function SubmissionVersionCard({ submission, isCurrent, commentLabel, formatDate, onOpenFile }: SubmissionVersionCardProps): JSX.Element {
  const review = submission.review;

  return (
    <article className={`space-y-3 rounded-card border bg-surface p-4 ${isCurrent ? 'border-brand-soft-hover shadow-surface' : 'border-line'}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-semibold text-brand-active">Версия {submission.versionNumber}</span>
        {isCurrent ? <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink-secondary">текущая</span> : null}
        {submission.isLate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            С опозданием
          </span>
        ) : null}
        <span className="ml-auto text-[12px] tabular-nums text-ink-muted">{formatDate(submission.submittedAt)}</span>
      </header>

      {submission.comment !== null ? <QuoteBlock label={commentLabel} text={submission.comment} /> : null}

      {submission.files.length > 0 ? (
        <div className="space-y-2">
          {submission.files.map((file) => (
            <FileRow key={file.id} name={file.name} sizeLabel={file.sizeLabel} onOpen={() => { onOpenFile(file, submission.submittedAt); }} />
          ))}
        </div>
      ) : null}

      {review !== null ? (
        <QuoteBlock
          tone={review.decision === 'Approved' ? 'success' : 'warning'}
          label={`${review.decision === 'Approved' ? 'Принято' : 'На доработку'} · ${review.reviewerName}`}
          text={review.comment ?? 'Без комментария'}
          meta={formatDate(review.createdAt)}
        />
      ) : null}
    </article>
  );
}
