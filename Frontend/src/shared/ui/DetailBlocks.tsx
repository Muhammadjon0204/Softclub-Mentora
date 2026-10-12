import { FileText } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

/**
 * Строительные блоки карточек деталей (задание, решение, проверка) — чтобы описание, факты,
 * статусы и комментарии везде выглядели одинаково и не были «голым» текстом на белом.
 */

type IconType = ComponentType<{ className?: string }>;

export type BlockTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<BlockTone, { icon: string; bar: string; text: string }> = {
  brand: { icon: 'bg-brand-soft text-brand', bar: 'bg-brand', text: 'text-brand-active' },
  info: { icon: 'bg-info-soft text-info', bar: 'bg-info', text: 'text-info' },
  success: { icon: 'bg-success-soft text-success', bar: 'bg-success', text: 'text-success' },
  warning: { icon: 'bg-warning-soft text-warning', bar: 'bg-warning', text: 'text-warning' },
  danger: { icon: 'bg-danger-soft text-danger', bar: 'bg-danger', text: 'text-danger' },
  neutral: { icon: 'bg-surface-hover text-ink-secondary', bar: 'bg-line-strong', text: 'text-ink-secondary' },
};

/** Подпись раздела: мелко, разрядкой, приглушённо. */
export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }): JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{children}</p>
      {aside}
    </div>
  );
}

/** Текстовый блок с иконкой — описание задания и подобное. */
export function TextPanel({ icon: Icon, title, text, emptyText }: { icon: IconType; title: string; text: string; emptyText: string }): JSX.Element {
  const isEmpty = text.trim().length === 0;
  return (
    <section className="rounded-card border border-line bg-surface-muted p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-brand shadow-surface">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-[12.5px] font-semibold text-ink">{title}</p>
      </div>
      <p className={`mt-2.5 whitespace-pre-wrap text-[13.5px] leading-[21px] ${isEmpty ? 'italic text-ink-disabled' : 'text-ink'}`}>
        {isEmpty ? emptyText : text}
      </p>
    </section>
  );
}

export interface MetaItem {
  icon: IconType;
  label: string;
  value: ReactNode;
  tone?: BlockTone;
}

/** Факты о задании плитками: иконка, подпись, значение. */
export function MetaTiles({ items, columns = 2 }: { items: MetaItem[]; columns?: 2 | 4 }): JSX.Element {
  return (
    <div className={`grid grid-cols-1 gap-2.5 ${columns === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2'}`}>
      {items.map(({ icon: Icon, label, value, tone = 'neutral' }) => (
        <div key={label} className="flex min-w-0 items-start gap-3 rounded-control border border-line bg-surface px-3.5 py-3">
          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${TONE[tone].icon}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">{label}</p>
            <p className="mt-0.5 text-[13px] font-medium leading-5 text-ink">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Статус или пояснение: цветная полоса слева, иконка, заголовок, текст и действие справа. */
export function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: BlockTone;
  icon: IconType;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-control border border-line bg-surface py-3.5 pl-5 pr-4">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${TONE[tone].bar}`} />
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONE[tone].icon}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        {children !== undefined ? <div className="mt-0.5 text-[12.5px] leading-[18px] text-ink-secondary">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/** Комментарий человека — цитатой с автором и временем. */
export function QuoteBlock({ label, text, meta, tone = 'brand' }: { label: string; text: string; meta?: string; tone?: BlockTone }): JSX.Element {
  return (
    <figure className="rounded-control bg-surface-muted px-4 py-3">
      <figcaption className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${TONE[tone].text}`}>{label}</figcaption>
      <blockquote className={`mt-1.5 whitespace-pre-wrap border-l-2 pl-3 text-[13.5px] leading-[21px] text-ink ${tone === 'success' ? 'border-success' : tone === 'warning' ? 'border-warning' : tone === 'danger' ? 'border-danger' : 'border-brand'}`}>
        {text}
      </blockquote>
      {meta !== undefined ? <p className="mt-2 text-[11.5px] text-ink-muted">{meta}</p> : null}
    </figure>
  );
}

/** Строка файла решения: открыть предпросмотр или детали. */
export function FileRow({ name, sizeLabel, onOpen }: { name: string; sizeLabel: string; onOpen: () => void }): JSX.Element {
  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-control border border-line bg-surface px-3 py-2.5 text-left transition hover:border-brand hover:shadow-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control-sm bg-brand-soft text-brand">
        <FileText className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink group-hover:text-brand">{name}</span>
        <span className="block text-[11.5px] text-ink-muted">{[extension, sizeLabel].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="shrink-0 text-[12px] font-medium text-brand opacity-0 transition group-hover:opacity-100">Открыть</span>
    </button>
  );
}
