import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

/**
 * Базовая поверхность Admin UI: тонкая граница + мягкая тень (раздел 6 промпта).
 * Никаких тяжёлых теней и вложенных border на каждый дочерний элемент —
 * внутренняя структура разделяется `divider`, а не рамками.
 */
export function Card({ children, padded = true, className = '', ...rest }: CardProps): JSX.Element {
  return (
    <div
      {...rest}
      className={`rounded-card border border-line bg-surface shadow-surface ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}

/** Карточка секции с заголовком и опциональным действием справа. */
export function SectionCard({
  title,
  description,
  action,
  children,
  padded = true,
  className = '',
  ...rest
}: SectionCardProps): JSX.Element {
  return (
    <Card padded={false} className={className} {...rest}>
      <div className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold leading-[22px] text-ink">{title}</h2>
          {description !== undefined ? (
            <p className="mt-0.5 text-[13px] leading-[19px] text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action !== undefined ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={padded ? 'p-5 sm:p-6' : ''}>{children}</div>
    </Card>
  );
}

/** Разделитель между логическими блоками внутри одной карточки. */
export function CardDivider({ className = '' }: { className?: string }): JSX.Element {
  return <hr className={`border-t border-divider ${className}`} />;
}
