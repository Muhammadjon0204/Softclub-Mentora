import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';

import { getGenericErrorMessage } from '../../api/problemDetails';
import { listTeamCandidates } from '../../api/teams';
import type { TeamCandidateDto } from '../../api/teams';
import { Modal } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { SkeletonRow } from '../../shared/ui/Skeleton';
import { UserAvatar } from '../avatars/UserAvatar';
import { TEAM_ROLE_HINT, teamRoleLabel } from './teamLabels';

export interface AddTeamMemberDialogProps {
  categoryId: string;
  teamName: string;
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onAdd: (userId: string, role: string) => Promise<unknown>;
}

const ACCOUNT_LABEL: Record<string, string> = { Admin: 'Администратор', Lead: 'Тимлид', Mentor: 'Ментор' };

/** Два шага на одном экране: выбрать человека своего филиала, затем — кем он будет в команде. */
export function AddTeamMemberDialog({ categoryId, teamName, open, isSubmitting, onClose, onAdd }: AddTeamMemberDialogProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TeamCandidateDto | null>(null);
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const term = useDeferredValue(search.trim());

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelected(null);
    setRole('');
    setError(null);
  }, [open]);

  const candidates = useQuery({
    queryKey: ['team-candidates', categoryId, term],
    queryFn: () => listTeamCandidates(categoryId, term),
    enabled: open,
  });

  function choose(candidate: TeamCandidateDto): void {
    setSelected(candidate);
    setError(null);
    // Самая скромная роль по умолчанию: тимлидом назначают только осознанно.
    setRole(candidate.assignableRoles[candidate.assignableRoles.length - 1] ?? '');
  }

  async function submit(): Promise<void> {
    if (selected === null || role === '') return;
    setError(null);
    try {
      await onAdd(selected.userId, role);
      onClose();
    } catch (caught) {
      setError(getGenericErrorMessage(caught));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next && !isSubmitting) onClose(); }}
      title="Добавить в команду"
      description={teamName}
      size="md"
      preventClose={isSubmitting}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            leadingIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
            disabled={selected === null || role === ''}
            isLoading={isSubmitting}
            onClick={() => { void submit(); }}
          >
            Добавить
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 focus-within:border-brand">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); }}
            placeholder="Поиск по имени или email"
            aria-label="Поиск по имени или email"
            className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-disabled"
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-control border border-line">
          {candidates.isPending ? (
            <div className="divide-y divide-divider">
              <SkeletonRow columns={2} />
              <SkeletonRow columns={2} />
              <SkeletonRow columns={2} />
            </div>
          ) : candidates.isError ? (
            <p role="alert" className="px-3 py-5 text-center text-[13px] text-danger">{getGenericErrorMessage(candidates.error)}</p>
          ) : candidates.data.length === 0 ? (
            <p className="px-3 py-5 text-center text-[13px] text-ink-muted">Некого добавить: все подходящие люди филиала уже в команде.</p>
          ) : (
            <ul className="divide-y divide-divider" aria-label="Кого добавить">
              {candidates.data.map((candidate) => {
                const active = selected?.userId === candidate.userId;
                return (
                  <li key={candidate.userId}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => { choose(candidate); }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${active ? 'bg-brand-soft' : 'hover:bg-surface-hover'}`}
                    >
                      <UserAvatar userId={candidate.userId} name={candidate.fullName} size={null} className="h-8 w-8 text-[11px]" fallbackClassName="bg-surface-muted text-ink-secondary" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-medium ${active ? 'text-brand' : 'text-ink'}`}>{candidate.fullName}</span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          <span>{ACCOUNT_LABEL[candidate.accountRole] ?? candidate.accountRole}</span>
                          {candidate.mainTeamName ? <span> · {candidate.mainTeamName}</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected === null ? null : (
          <fieldset className="space-y-2">
            <legend className="text-[12.5px] font-semibold text-ink-secondary">Роль в команде</legend>
            {selected.assignableRoles.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 transition-colors ${role === option ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-hover'}`}
              >
                <input
                  type="radio"
                  name="team-role"
                  value={option}
                  checked={role === option}
                  onChange={() => { setRole(option); }}
                  className="mt-0.5 accent-brand"
                />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{teamRoleLabel(option)}</span>
                  <span className="block text-[12px] text-ink-muted">{TEAM_ROLE_HINT[option]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {error === null ? null : <p role="alert" className="text-[13px] text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
