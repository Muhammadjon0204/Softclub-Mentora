import { Building2, Pencil, Power, PowerOff, UserCog, UserPlus } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { Tooltip } from '../../shared/overlays';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { BranchActivityEntry, BranchActivityKind, PreviewBranchDetails } from './branchPresentation';

const KIND_META: Record<BranchActivityKind, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  created: { icon: Building2, tone: 'bg-brand-soft text-brand' },
  updated: { icon: Pencil, tone: 'bg-surface-muted text-ink-secondary' },
  admin_assigned: { icon: UserPlus, tone: 'bg-info-soft text-info' },
  admin_changed: { icon: UserCog, tone: 'bg-info-soft text-info' },
  activated: { icon: Power, tone: 'bg-success-soft text-success' },
  deactivated: { icon: PowerOff, tone: 'bg-danger-soft text-danger' },
};

/** Та же timeline-визуализация, что и у Users (раздел 27 промпта) — человекочитаемый текст, без raw event keys. */
export function BranchActivitySection({ branch }: { branch: PreviewBranchDetails }): JSX.Element {
  const entries = branch.activity.slice(0, 8);

  if (entries.length === 0) {
    return <EmptyState icon={<Building2 className="h-5 w-5" aria-hidden="true" />} title="Активности пока нет" description="События появятся здесь по мере изменений." />;
  }

  return (
    <ol className="space-y-0.5">
      {entries.map((entry, index) => (
        <ActivityRow key={entry.id} entry={entry} isLast={index === entries.length - 1} />
      ))}
    </ol>
  );
}

function ActivityRow({ entry, isLast }: { entry: BranchActivityEntry; isLast: boolean }): JSX.Element {
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-divider" /> : null}
      <span aria-hidden="true" className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-medium text-ink">{entry.label}</p>
        {entry.detail !== undefined ? <p className="mt-0.5 text-[12px] text-ink-secondary">{entry.detail}</p> : null}
        <p className="mt-1 text-[11.5px] text-ink-muted">
          {entry.actorName} ·{' '}
          <Tooltip content={entry.absoluteLabel} placement="top">
            <span className="cursor-default">{entry.relativeTime}</span>
          </Tooltip>
        </p>
      </div>
    </li>
  );
}
