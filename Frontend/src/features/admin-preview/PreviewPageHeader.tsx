import type { ReactNode } from 'react';

interface PreviewPageHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
}

/** Единый заголовок страницы для всех UI-прототипов Admin-раздела — та же форма, что и у Dashboard. */
export function PreviewPageHeader({ title, subtitle, action }: PreviewPageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-9 tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      </div>
      {action !== undefined ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
