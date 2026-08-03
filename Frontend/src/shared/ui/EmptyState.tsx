import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Пустое состояние: без «детской иллюстрации», с понятным следующим шагом. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mx-auto max-w-sm text-[13px] leading-[19px] text-ink-muted">{description}</p>
      </div>
      {action !== undefined ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
