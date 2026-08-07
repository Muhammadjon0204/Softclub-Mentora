import { Check, Copy, Eye, ScrollText, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewDrawer } from '../../features/admin-preview/PreviewDrawer';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { BRANCH_DIRECTORY } from '../../features/admin-preview/branchDirectory';
import {
  AUDIT_RESULT_LABEL,
  PREVIEW_AUDIT_ENTRIES,
  PREVIEW_AUDIT_SUMMARY,
  type PreviewAuditEntry,
  type PreviewAuditResult,
} from '../../mocks/ui-preview/audit.preview';
import { useAuth } from '../../auth/useAuth';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

const RESULT_TONE: Record<PreviewAuditResult, BadgeTone> = {
  Success: 'success',
  Rejected: 'warning',
  Error: 'danger',
};
const RESULT_OPTIONS = [
  { value: 'all', label: 'Все результаты' },
  { value: 'Success', label: AUDIT_RESULT_LABEL.Success },
  { value: 'Rejected', label: AUDIT_RESULT_LABEL.Rejected },
  { value: 'Error', label: AUDIT_RESULT_LABEL.Error },
];
const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  ...BRANCH_DIRECTORY.map((branch) => ({ value: branch.rawName, label: branch.displayName })),
];

function shortCorrelationId(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function CopyCorrelationId({ id }: { id: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(id).then(() => {
          setCopied(true);
          window.setTimeout(() => { setCopied(false); }, 1500);
        });
      }}
      title={id}
      className="inline-flex items-center gap-1.5 rounded-control-sm px-1.5 py-0.5 font-mono text-[12px] text-ink-secondary transition hover:bg-surface-hover hover:text-ink"
    >
      {shortCorrelationId(id)}
      {copied ? <Check className="h-3 w-3 text-success" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}

/**
 * UI-прототип /admin/audit — layout-полироль (раздел 7): постоянная правая
 * колонка «Детали события» удалена — теперь overlay-drawer по клику строки
 * (как и в Assignments), таблица на всю ширину.
 */
export function AuditPage(): JSX.Element {
  const { user: authUser } = useAuth();
  const isOrgAdmin = authUser?.adminScope === 'Organization';
  const currentBranchRawName = authUser?.branch?.name ?? null;

  // Branch Admin не видит Organization-level записи (branchName === null, TEN-041)
  // и записи чужих филиалов — фильтр на границе, до поиска и остальных фильтров.
  const scopedEntries = useMemo(
    () => (isOrgAdmin ? PREVIEW_AUDIT_ENTRIES : PREVIEW_AUDIT_ENTRIES.filter((entry) => entry.branchName === currentBranchRawName)),
    [isOrgAdmin, currentBranchRawName],
  );

  // Минимальный deep-link из Dashboard-карточки «Последняя активность» (?q=<имя>) —
  // заполняет уже существующий поиск.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [branch, setBranch] = useState('all');
  const [result, setResult] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedEntries.filter((entry) => {
      if (
        query.length > 0 &&
        !entry.actorName.toLowerCase().includes(query) &&
        !entry.action.toLowerCase().includes(query) &&
        !entry.entityLabel.toLowerCase().includes(query)
      ) {
        return false;
      }
      if (isOrgAdmin && branch !== 'all' && entry.branchName !== branch) return false;
      if (result !== 'all' && entry.result !== result) return false;
      return true;
    });
  }, [scopedEntries, search, branch, result, isOrgAdmin]);

  const summary = isOrgAdmin
    ? PREVIEW_AUDIT_SUMMARY
    : {
        today: scopedEntries.length,
        success: scopedEntries.filter((entry) => entry.result === 'Success').length,
        rejected: scopedEntries.filter((entry) => entry.result === 'Rejected').length,
        system: scopedEntries.filter((entry) => entry.actorName === 'Система').length,
      };

  const selected: PreviewAuditEntry | null = rows.find((entry) => entry.id === selectedId) ?? null;

  const openDrawer = (id: string): void => {
    setSelectedId(id);
  };

  const closeDrawer = (): void => {
    const idToFocus = selectedId;
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus();
    });
  };

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Журнал аудита"
        subtitle={isOrgAdmin ? 'История административных и системных действий' : 'История действий в филиале'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ScrollText className="h-5 w-5" aria-hidden="true" />} label="Событий сегодня" value={String(summary.today)} />
        <PreviewMetricCard icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} label="Успешные" value={String(summary.success)} />
        <PreviewMetricCard icon={<ShieldX className="h-5 w-5" aria-hidden="true" />} label="Отклонённые" value={String(summary.rejected)} tone="warning" />
        <PreviewMetricCard icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />} label="Системные" value={String(summary.system)} />
      </div>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по пользователю, действию, объекту…" value={search} onChange={setSearch} />
          {isOrgAdmin ? <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} /> : null}
          <PreviewSelect label="Результат" value={result} onChange={setResult} options={RESULT_OPTIONS} />
          <PreviewResetButton
            onClick={() => {
              setSearch('');
              setBranch('all');
              setResult('all');
            }}
          />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh className="w-[120px]">Время</PreviewTh>
            <PreviewTh className="w-[190px]">Пользователь</PreviewTh>
            {isOrgAdmin ? <PreviewTh className="w-[150px]">Филиал</PreviewTh> : null}
            <PreviewTh>Действие</PreviewTh>
            <PreviewTh>Объект</PreviewTh>
            <PreviewTh className="w-[105px]">Результат</PreviewTh>
            <PreviewTh className="w-[130px]">Correlation ID</PreviewTh>
            <PreviewTh className="w-11" />
          </PreviewTableHead>
          <tbody>
            {rows.map((entry) => (
              <PreviewTr
                key={entry.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(entry.id, node);
                  else rowRefs.current.delete(entry.id);
                }}
                selected={entry.id === selectedId}
                onClick={() => {
                  openDrawer(entry.id);
                }}
              >
                <PreviewTd className="whitespace-nowrap text-[12.5px]">{entry.timeLabel}</PreviewTd>
                <PreviewTd>
                  <PreviewCellStack primary={entry.actorName} secondary={entry.actorRole} />
                </PreviewTd>
                {isOrgAdmin ? <PreviewTd className="truncate text-[12.5px]">{entry.branchName ?? '—'}</PreviewTd> : null}
                <PreviewTd className="truncate" title={entry.action}>
                  {entry.action}
                </PreviewTd>
                <PreviewTd className="truncate text-[12.5px]" title={entry.entityLabel}>
                  {entry.entityLabel}
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap">
                  <Badge tone={RESULT_TONE[entry.result]}>{AUDIT_RESULT_LABEL[entry.result]}</Badge>
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap">
                  <CopyCorrelationId id={entry.correlationId} />
                </PreviewTd>
                <PreviewTd className="text-right">
                  <IconButton
                    label="Открыть детали"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDrawer(entry.id);
                    }}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </PreviewTd>
              </PreviewTr>
            ))}
          </tbody>
        </PreviewTable>
      </Card>

      <PreviewDrawer
        open={selected !== null}
        onClose={closeDrawer}
        width="detail"
        title={selected?.action ?? ''}
        description={selected?.timeLabel}
      >
        {selected !== null ? (
          <div className="space-y-4">
            <div>
              <p className="text-[12px] uppercase tracking-wide text-ink-muted">Результат</p>
              <div className="mt-1">
                <Badge tone={RESULT_TONE[selected.result]}>{AUDIT_RESULT_LABEL[selected.result]}</Badge>
              </div>
            </div>
            <dl className="space-y-2.5">
              <DetailRow label="Пользователь" value={`${selected.actorName} · ${selected.actorRole}`} />
              <DetailRow label="Филиал" value={selected.branchName ?? '—'} />
              <DetailRow label="Объект" value={selected.entityLabel} />
              <DetailRow label="Correlation ID" value={selected.correlationId} mono />
              {selected.metadata.map((row) => (
                <DetailRow key={row.key} label={row.key} value={row.value} />
              ))}
            </dl>
          </div>
        ) : null}
      </PreviewDrawer>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  );
}
