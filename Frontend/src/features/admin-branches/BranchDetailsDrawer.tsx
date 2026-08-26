import { useEffect, useState } from 'react';

import { Drawer } from '../../shared/overlays';
import { ErrorState } from '../../shared/ui/ErrorState';
import { BranchActionMenu } from './BranchActionMenu';
import { BranchActivitySection } from './BranchActivitySection';
import { BranchAdminSection } from './BranchAdminSection';
import { BranchMetricsSection } from './BranchMetricsSection';
import { BranchOverviewSection } from './BranchOverviewSection';
import type { PreviewBranchDetails } from './branchPresentation';

type BranchDetailsTab = 'overview' | 'admin' | 'metrics' | 'activity';

const TABS: { id: BranchDetailsTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'admin', label: 'Администратор' },
  { id: 'metrics', label: 'Показатели' },
  { id: 'activity', label: 'Активность' },
];

export interface BranchDetailsDrawerProps {
  branchId: string | null;
  /** Уже scope-отфильтрованный список — чужой Branch неотличим от несуществующего (ADR-001, раздел 2.8). */
  branches: PreviewBranchDetails[];
  onClose: () => void;
  isOrgAdmin: boolean;
  onOpenUser: (userId: string) => void;
  onEdit: (branch: PreviewBranchDetails) => void;
  onAssignAdmin: (branch: PreviewBranchDetails) => void;
  onChangeAdmin: (branch: PreviewBranchDetails) => void;
  onActivate: (branch: PreviewBranchDetails) => void;
  onDeactivate: (branch: PreviewBranchDetails) => void;
}

/** Открывается по клику на строку (раздел 24 промпта) — филиал ищется в уже загруженном `branches` (реальный `useBranchesQuery`). */
export function BranchDetailsDrawer({
  branchId,
  branches,
  onClose,
  isOrgAdmin,
  onOpenUser,
  onEdit,
  onAssignAdmin,
  onChangeAdmin,
  onActivate,
  onDeactivate,
}: BranchDetailsDrawerProps): JSX.Element {
  const branch = branchId !== null ? branches.find((candidate) => candidate.id === branchId) : undefined;
  const [tab, setTab] = useState<BranchDetailsTab>('overview');

  useEffect(() => {
    if (branchId !== null) setTab('overview');
  }, [branchId]);

  const open = branchId !== null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={branch?.name ?? 'Филиал'}
      description={branch !== undefined ? `${branch.code} · ${branch.city}` : undefined}
      size="lg"
      headerActions={
        branch !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium"
              role="status"
              aria-label={`Статус: ${branch.isActive ? 'Активен' : 'Неактивен'}`}
            >
              <span aria-hidden="true" className={`h-[6px] w-[6px] rounded-full ${branch.isActive ? 'bg-success' : 'bg-ink-disabled'}`} />
              <span className={branch.isActive ? 'text-success' : 'text-ink-muted'}>{branch.isActive ? 'Активен' : 'Неактивен'}</span>
            </span>
            <BranchActionMenu
              branch={branch}
              context="drawer"
              isOrgAdmin={isOrgAdmin}
              onEdit={() => { onEdit(branch); }}
              onAssignAdmin={() => { onAssignAdmin(branch); }}
              onChangeAdmin={() => { onChangeAdmin(branch); }}
              onActivate={() => { onActivate(branch); }}
              onDeactivate={() => { onDeactivate(branch); }}
            />
          </div>
        ) : undefined
      }
    >
      {branchId === null ? null : branch === undefined ? (
        <ErrorState title="Филиал не найден" error={null} />
      ) : (
        <div className="space-y-5">
          <div role="tablist" aria-label="Разделы профиля филиала" className="flex gap-1 rounded-control bg-surface-muted p-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => { setTab(item.id); }}
                className={`h-8 flex-1 rounded-control-sm text-[12.5px] font-medium transition ${tab === item.id ? 'bg-surface text-ink shadow-surface' : 'text-ink-muted hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'overview' ? <BranchOverviewSection branch={branch} /> : null}
            {tab === 'admin' ? (
              <BranchAdminSection
                branch={branch}
                isOrgAdmin={isOrgAdmin}
                onOpenUser={onOpenUser}
                onAssignAdmin={() => { onAssignAdmin(branch); }}
                onChangeAdmin={() => { onChangeAdmin(branch); }}
              />
            ) : null}
            {tab === 'metrics' ? <BranchMetricsSection branch={branch} /> : null}
            {tab === 'activity' ? <BranchActivitySection branch={branch} /> : null}
          </div>
        </div>
      )}
    </Drawer>
  );
}
