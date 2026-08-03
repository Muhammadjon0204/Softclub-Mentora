import { useId, useState } from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

/**
 * Лёгкий tooltip для формул метрик (`MetricTooltip`). Открывается по hover
 * И по focus — клавиатурный пользователь обязан получить ту же информацию
 * (раздел 30 промпта: hover не может быть единственным способом).
 */
export function Tooltip({ content, children }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <span
        onMouseEnter={() => {
          setVisible(true);
        }}
        onMouseLeave={() => {
          setVisible(false);
        }}
        onFocus={() => {
          setVisible(true);
        }}
        onBlur={() => {
          setVisible(false);
        }}
        aria-describedby={visible ? id : undefined}
      >
        {children}
      </span>
      {visible ? (
        <span
          role="tooltip"
          id={id}
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-control-sm bg-ink px-2.5 py-1.5 text-center text-[12px] leading-[16px] text-white shadow-popover animate-fade-in"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
