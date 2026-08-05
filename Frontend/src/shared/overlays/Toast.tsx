import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { IconButton } from '../ui/Button';
import { useToastContext } from './ToastProvider';
import type { ToastEntry, ToastVariant } from './ToastProvider';

const VARIANT_ICON: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_TILE_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
};

/** warning/error announce assertively — но через role="status", не "alert", чтобы не быть избыточно навязчивым. */
const VARIANT_LIVE: Record<ToastVariant, 'polite' | 'assertive'> = {
  success: 'polite',
  info: 'polite',
  warning: 'assertive',
  error: 'assertive',
};

/** Один toast: иконка-плитка, заголовок/текст, опциональный action, закрытие. Пауза countdown при hover/focus. */
export function Toast({ entry }: { entry: ToastEntry }): JSX.Element {
  const { dismiss, pause, resume } = useToastContext();
  const Icon = VARIANT_ICON[entry.variant];

  // Двойной rAF: браузер рисует "закрытое" состояние до первого рендера, затем transition в открытое действительно проигрывается.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setEntered(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const presenceClasses = entry.closing
    ? 'duration-150 ease-in opacity-0 translate-x-2'
    : entered
      ? 'duration-[180ms] ease-out opacity-100 translate-x-0 translate-y-0'
      : 'duration-0 opacity-0 translate-x-3 -translate-y-1';

  return (
    <div
      role="status"
      aria-live={VARIANT_LIVE[entry.variant]}
      onMouseEnter={() => {
        pause(entry.id);
      }}
      onMouseLeave={() => {
        resume(entry.id);
      }}
      onFocus={() => {
        pause(entry.id);
      }}
      onBlur={() => {
        resume(entry.id);
      }}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-[13px] border border-line bg-surface p-3.5 shadow-popover transition-[opacity,transform] motion-reduce:transition-none motion-reduce:transform-none ${presenceClasses}`}
    >
      <span aria-hidden="true" className={`flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-control-sm ${VARIANT_TILE_CLASSES[entry.variant]}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {entry.title !== undefined ? <p className="text-[13px] font-semibold leading-[18px] text-ink">{entry.title}</p> : null}
        <p className="text-[12px] leading-[17px] text-ink-secondary">{entry.message}</p>
        {entry.action !== undefined ? (
          <button
            type="button"
            onClick={() => {
              entry.action?.onClick();
              dismiss(entry.id);
            }}
            className="mt-1.5 text-[12px] font-semibold text-brand hover:text-brand-hover focus-visible:outline-none"
          >
            {entry.action.label}
          </button>
        ) : null}
      </div>
      {entry.dismissible ? (
        <IconButton
          label="Закрыть"
          size="sm"
          className="-mr-1 -mt-1 h-7 w-7"
          onClick={() => {
            dismiss(entry.id);
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}
