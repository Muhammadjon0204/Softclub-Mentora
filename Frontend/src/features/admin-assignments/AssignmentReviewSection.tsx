import { CheckCircle2, ClipboardCheck, RotateCcw } from 'lucide-react';

import { EmptyState } from '../../shared/ui/EmptyState';
import type { ReviewInfo } from './assignmentPresentation';

export function AssignmentReviewSection({ review }: { review: ReviewInfo | null }): JSX.Element {
  if (review === null) {
    return <EmptyState icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />} title="Решение ещё не проверено" description="Здесь появится решение Lead после проверки последней отправки." />;
  }

  const isApproved = review.decision === 'Approved';

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 rounded-control border p-3.5 ${isApproved ? 'border-success-border bg-success-soft' : 'border-warning-border bg-warning-soft'}`}>
        <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isApproved ? 'bg-success text-white' : 'bg-warning text-white'}`}>
          {isApproved ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <RotateCcw className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div>
          <p className={`text-[13.5px] font-semibold ${isApproved ? 'text-success' : 'text-warning'}`}>{isApproved ? 'Одобрено' : 'Возвращено на доработку'}</p>
          <p className="text-[12px] text-ink-muted">Попытка {review.submissionVersion} · {review.decidedAtLabel}</p>
        </div>
      </div>

      <dl className="divide-y divide-divider">
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-muted">Проверил</span>
          <span className="font-medium text-ink">{review.reviewerName}</span>
        </div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-ink-muted">Дата решения</span>
          <span className="font-medium text-ink">{review.decidedAtLabel}</span>
        </div>
      </dl>

      {review.comment !== null ? (
        <div>
          <h4 className="mb-1.5 text-[12.5px] font-semibold text-ink-secondary">Комментарий</h4>
          <p className="whitespace-pre-line break-words text-[13px] leading-[20px] text-ink-secondary">{review.comment}</p>
        </div>
      ) : null}
    </div>
  );
}
