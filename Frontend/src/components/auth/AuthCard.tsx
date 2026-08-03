import type { ReactNode } from 'react';

import { OfflineBanner } from '../OfflineBanner';
import { BrandLogo } from './BrandLogo';

interface AuthCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Каркас всех auth-страниц: центрированная карточка max-w-md, адаптив от 360px. */
export function AuthCard({ title, description, children, footer }: AuthCardProps): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(60rem_40rem_at_50%_-10rem,rgba(99,102,241,0.12),transparent)]">
      <OfflineBanner />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <main className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <BrandLogo />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {description !== undefined ? (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>

          {footer !== undefined ? (
            <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
