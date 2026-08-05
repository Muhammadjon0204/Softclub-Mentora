import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { emptyOrValue } from './branchPresentation';
import type { PreviewBranchDetails } from './branchPresentation';

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/** Строгий summary-блок (раздел 24 промпта) — без технических Organization/Branch id. */
export function BranchOverviewSection({ branch }: { branch: PreviewBranchDetails }): JSX.Element {
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Код', value: branch.code },
    { label: 'Город', value: branch.city },
    { label: 'Адрес', value: branch.address },
    { label: 'Часовой пояс', value: branch.timezone },
    { label: 'Email', value: emptyOrValue(branch.email) },
    { label: 'Телефон', value: emptyOrValue(branch.phone) },
    {
      label: 'Статус',
      value: (
        <span className={`inline-flex items-center gap-1.5 ${branch.isActive ? 'text-success' : 'text-ink-muted'}`}>
          <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${branch.isActive ? 'bg-success' : 'bg-ink-disabled'}`} />
          {branch.isActive ? 'Активен' : 'Неактивен'}
        </span>
      ),
    },
    { label: 'Дата создания', value: branch.createdLabel },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5 rounded-control border border-line bg-surface-muted p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{branch.name}</p>
          <p className="truncate text-[12.5px] text-ink-muted">{branch.code} · {branch.city}</p>
        </div>
      </div>

      <dl className="divide-y divide-divider px-0.5">
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </div>
  );
}
