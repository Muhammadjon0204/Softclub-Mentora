import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface DashboardCardFooterLinkProps {
  to: string;
  children: ReactNode;
}

/**
 * Единый footer-компонент для всех insight/bottom карточек (раздел 20
 * полироли) — одна и та же высота/padding/hover везде, вместо четырёх слегка
 * разных футеров.
 */
export function DashboardCardFooterLink({ to, children }: DashboardCardFooterLinkProps): JSX.Element {
  return (
    <Link
      to={to}
      className="group flex min-h-[50px] w-full shrink-0 items-center justify-center gap-1.5 border-t border-divider px-4 text-[12.5px] font-semibold text-brand no-underline transition-colors duration-150 hover:bg-surface-hover hover:text-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
    >
      {children}
      <ChevronRight
        className="h-[15px] w-[15px] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        aria-hidden="true"
      />
    </Link>
  );
}
