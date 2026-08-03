import { CheckCircle2, ClipboardList, Clock3, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { PreviewDrawer } from '../../features/admin-preview/PreviewDrawer';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewCellStack, PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import {
  ASSIGNMENT_STATUS_LABEL,
  PREVIEW_ASSIGNMENTS,
  PREVIEW_ASSIGNMENT_STATUS_DISTRIBUTION,
  PREVIEW_ASSIGNMENT_SUMMARY,
  type PreviewAssignment,
  type PreviewAssignmentStatus,
} from '../../mocks/ui-preview/assignments.preview';
import { Badge } from '../../shared/ui/Badge';
import type { BadgeTone } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';

const STATUS_TONE: Record<PreviewAssignmentStatus, BadgeTone> = {
  Assigned: 'neutral',
  Submitted: 'info',
  InReview: 'brand',
  NeedsRework: 'warning',
  Overdue: 'warning',
  Approved: 'success',
};

const BRANCH_OPTIONS = [
  { value: 'all', label: 'Все филиалы' },
  { value: 'Главный офис', label: 'Главный офис' },
  { value: 'Филиал Худжанд', label: 'Филиал Худжанд' },
  { value: 'Филиал Бохтар', label: 'Филиал Бохтар' },
];
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Все категории' },
  { value: 'C#', label: 'C#' },
  { value: 'Frontend', label: 'Frontend' },
  { value: 'Python', label: 'Python' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
  { value: 'Mobile Development', label: 'Mobile Development' },
  { value: 'QA', label: 'QA' },
  { value: 'DevOps', label: 'DevOps' },
  { value: 'Data Science', label: 'Data Science' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  ...Object.entries(ASSIGNMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

/**
 * UI-прототип /admin/assignments — layout-полироль (раздел 6): постоянная
 * правая колонка «Хронология» удалена (растягивалась на всю высоту таблицы и
 * пустовала, пока строка не выбрана) — теперь это overlay-drawer по клику.
 */
export function AssignmentsPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_ASSIGNMENTS.filter((a) => {
      if (query.length > 0 && !a.title.toLowerCase().includes(query) && !a.mentorName.toLowerCase().includes(query)) return false;
      if (branch !== 'all' && a.branchName !== branch) return false;
      if (category !== 'all' && a.categoryName !== category) return false;
      if (status !== 'all' && a.status !== status) return false;
      return true;
    });
  }, [search, branch, category, status]);

  const selected: PreviewAssignment | null = rows.find((a) => a.id === selectedId) ?? null;

  const closeDrawer = (): void => {
    const idToFocus = selectedId;
    setSelectedId(null);
    // Фокус возвращается на строку, из которой был открыт drawer (раздел 6).
    window.requestAnimationFrame(() => {
      if (idToFocus !== null) rowRefs.current.get(idToFocus)?.focus();
    });
  };

  return (
    <div className="space-y-6">
      <PreviewPageHeader title="Задания" subtitle="Контроль состояния заданий по всем направлениям" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} label="Активные" value={String(PREVIEW_ASSIGNMENT_SUMMARY.active)} />
        <PreviewMetricCard icon={<Clock3 className="h-5 w-5" aria-hidden="true" />} label="Ожидают проверки" value={String(PREVIEW_ASSIGNMENT_SUMMARY.pendingReview)} />
        <PreviewMetricCard
          icon={<TriangleAlert className="h-5 w-5" aria-hidden="true" />}
          label="Просрочены"
          value={String(PREVIEW_ASSIGNMENT_SUMMARY.overdue)}
          tone="warning"
        />
        <PreviewMetricCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} label="Завершены за период" value={String(PREVIEW_ASSIGNMENT_SUMMARY.approvedThisPeriod)} />
      </div>

      <Card padded={false} className="flex max-h-[108px] flex-col gap-2.5 overflow-hidden px-5 py-3.5 sm:px-6">
        <p className="text-[13px] font-medium text-ink-secondary">Распределение по статусам</p>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_ASSIGNMENT_STATUS_DISTRIBUTION.map((entry) => (
            <span
              key={entry.status}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1 text-[12.5px]"
            >
              <Badge tone={STATUS_TONE[entry.status]}>{ASSIGNMENT_STATUS_LABEL[entry.status]}</Badge>
              <span className="font-semibold tabular-nums text-ink">{entry.count}</span>
            </span>
          ))}
        </div>
      </Card>

      <Card padded={false} className="min-w-0">
        <PreviewToolbar>
          <PreviewSearchInput placeholder="Поиск по заданию или ментору…" value={search} onChange={setSearch} />
          <PreviewSelect label="Филиал" value={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
          <PreviewSelect label="Категория" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
          <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <PreviewResetButton
            onClick={() => {
              setSearch('');
              setBranch('all');
              setCategory('all');
              setStatus('all');
            }}
          />
        </PreviewToolbar>

        <PreviewTable>
          <PreviewTableHead>
            <PreviewTh>Задание</PreviewTh>
            <PreviewTh className="w-[150px]">Ментор</PreviewTh>
            <PreviewTh className="w-[150px]">Scope</PreviewTh>
            <PreviewTh className="w-[130px]">Статус</PreviewTh>
            <PreviewTh className="w-[135px]">Дедлайн</PreviewTh>
            <PreviewTh className="w-[130px]">Активность</PreviewTh>
          </PreviewTableHead>
          <tbody>
            {rows.slice(0, 16).map((assignment) => (
              <PreviewTr
                key={assignment.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(assignment.id, node);
                  else rowRefs.current.delete(assignment.id);
                }}
                selected={assignment.id === selectedId}
                onClick={() => {
                  setSelectedId(assignment.id);
                }}
              >
                <PreviewTd className="font-medium text-ink" title={assignment.title}>
                  <span className="block truncate">{assignment.title}</span>
                </PreviewTd>
                <PreviewTd className="truncate">{assignment.mentorName}</PreviewTd>
                <PreviewTd>
                  <PreviewCellStack primary={assignment.branchName} secondary={assignment.categoryName} />
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap">
                  <Badge tone={STATUS_TONE[assignment.status]}>{ASSIGNMENT_STATUS_LABEL[assignment.status]}</Badge>
                </PreviewTd>
                <PreviewTd className="whitespace-nowrap text-[12.5px]">{assignment.dueLabel}</PreviewTd>
                <PreviewTd className="whitespace-nowrap text-[12.5px]">{assignment.lastActivityLabel}</PreviewTd>
              </PreviewTr>
            ))}
          </tbody>
        </PreviewTable>
      </Card>

      <PreviewDrawer
        open={selected !== null}
        onClose={closeDrawer}
        width="detail"
        title={selected?.title ?? ''}
        description="Admin здесь только наблюдает — действий над заданием нет"
      >
        {selected !== null ? (
          <div className="space-y-5">
            <div>
              <Badge tone={STATUS_TONE[selected.status]}>{ASSIGNMENT_STATUS_LABEL[selected.status]}</Badge>
            </div>
            <dl className="space-y-2.5">
              <DetailRow label="Ментор" value={selected.mentorName} />
              <DetailRow label="Филиал" value={selected.branchName} />
              <DetailRow label="Категория" value={selected.categoryName} />
              <DetailRow label="Дедлайн" value={selected.dueLabel} />
              <DetailRow label="Источник" value={selected.source} />
              <DetailRow label="Последняя активность" value={selected.lastActivityLabel} />
            </dl>

            <div className="border-t border-divider pt-4">
              <p className="mb-3 text-[13px] font-semibold text-ink">Хронология</p>
              <ol className="space-y-4">
                <TimelineStep label="Назначено" timeLabel="—" done />
                <TimelineStep label="Отправлено на проверку" timeLabel={selected.lastActivityLabel} done={selected.status !== 'Assigned'} />
                <TimelineStep
                  label="На проверке у Lead"
                  timeLabel={selected.status === 'InReview' ? 'сейчас' : '—'}
                  done={selected.status === 'InReview' || selected.status === 'Approved'}
                />
                <TimelineStep label="Решение" timeLabel={selected.status === 'Approved' ? selected.dueLabel : '—'} done={selected.status === 'Approved'} />
              </ol>
            </div>
          </div>
        ) : null}
      </PreviewDrawer>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{value}</dd>
    </div>
  );
}

function TimelineStep({ label, timeLabel, done }: { label: string; timeLabel: string; done: boolean }): JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-brand text-white' : 'bg-surface-muted text-ink-disabled'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium ${done ? 'text-ink' : 'text-ink-muted'}`}>{label}</p>
        <p className="text-[12px] text-ink-muted">{timeLabel}</p>
      </div>
    </li>
  );
}
