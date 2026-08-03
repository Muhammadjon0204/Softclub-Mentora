import type { ReactNode } from 'react';

import { Card } from '../../shared/ui/Card';

interface InsightCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Единая оболочка для четырёх insight-карточек (раздел 11 полироли): Header
 * фиксированной визуальной высоты + Body (flex-1) + Footer фиксированной
 * высоты. Раньше каждая карточка сама верстала header/footer со своими
 * paddings — отсюда разная высота и «скачущие» footer links.
 */
export function InsightCard({ title, subtitle, children, footer }: InsightCardProps): JSX.Element {
  return (
    <Card padded={false} className="flex h-full min-h-[360px] flex-col overflow-hidden">
      <div className="flex min-h-[74px] shrink-0 flex-col justify-center border-b border-divider px-4 py-3">
        <h3 className="text-[15px] font-semibold leading-5 text-ink">{title}</h3>
        <p className="mt-0.5 text-[12px] leading-[17px] text-ink-muted">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1 px-4 py-3.5">{children}</div>
      {footer}
    </Card>
  );
}
