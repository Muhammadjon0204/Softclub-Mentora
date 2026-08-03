import { Building2, Pencil, Plus, Power, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import {
  PreviewCellStack,
  PreviewTable,
  PreviewTableHead,
  PreviewTd,
  PreviewTh,
  PreviewTr,
} from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import { PREVIEW_BRANCHES, PREVIEW_BRANCH_USER_DISTRIBUTION } from '../../mocks/ui-preview/branches.preview';
import { StatusDot } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card, SectionCard } from '../../shared/ui/Card';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'active', label: 'Активные' },
  { value: 'inactive', label: 'Неактивные' },
];

const CITY_OPTIONS = [
  { value: 'all', label: 'Все города' },
  { value: 'Душанбе', label: 'Душанбе' },
  { value: 'Худжанд', label: 'Худжанд' },
  { value: 'Бохтар', label: 'Бохтар' },
];

function healthToneClasses(value: number): { text: string; bar: string } {
  if (value >= 90) return { text: 'text-success', bar: 'bg-success' };
  if (value >= 75) return { text: 'text-warning', bar: 'bg-warning' };
  return { text: 'text-danger', bar: 'bg-danger' };
}

/** Убирает повторяющийся город из адреса — название филиала уже задаёт контекст. */
function formatStreet(address: string): string {
  return address.replace(/^г\.\s*[^,]+,\s*/, '');
}

/** Число + тонкая progress-line вместо тяжёлой цветной капсулы. */
function HealthValue({ value }: { value: number }): JSX.Element {
  const tone = healthToneClasses(value);
  return (
    <div>
      <span className={`text-[13.5px] font-semibold tabular-nums ${tone.text}`}>{value}%</span>
      <div className="mt-1 h-[3px] w-9 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/**
 * UI-прототип /admin/branches — таблица теперь главный элемент страницы
 * (раздел 4 layout-полироли): «Код» смёржен во вторую строку Branch cell,
 * «Распределение по филиалам» уходит под таблицу ниже 1600px и не растягивается
 * по высоте (`h-fit self-start`, а не `h-full`).
 */
export function BranchesPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [city, setCity] = useState('all');
  const [toastMessage, showToast] = usePreviewToast();

  // Минимальный deep-link из Dashboard-карточки «Лучший филиал» (?branchId=<id>):
  // подсвечиваем и прокручиваем к строке, ничего в дизайне страницы не меняя.
  const [searchParams] = useSearchParams();
  const highlightBranchId = searchParams.get('branchId');
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (highlightBranchId === null) return;
    rowRefs.current.get(highlightBranchId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightBranchId]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREVIEW_BRANCHES.filter((branch) => {
      if (query.length > 0 && !branch.name.toLowerCase().includes(query) && !branch.code.toLowerCase().includes(query)) {
        return false;
      }
      if (status === 'active' && !branch.isActive) return false;
      if (status === 'inactive' && branch.isActive) return false;
      if (city !== 'all' && !branch.address.includes(city)) return false;
      return true;
    });
  }, [search, status, city]);

  const totalCategories = PREVIEW_BRANCHES.reduce((sum, b) => sum + b.categoriesCount, 0);
  const withoutAdmin = PREVIEW_BRANCHES.filter((b) => b.adminName === null).length;

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Филиалы"
        subtitle="Управление филиалами и их текущим состоянием"
        action={
          <Button
            variant="primary"
            leadingIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              showToast('Функция будет подключена позже');
            }}
          >
            Добавить филиал
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PreviewMetricCard icon={<Building2 className="h-5 w-5" aria-hidden="true" />} label="Всего филиалов" value="3" />
        <PreviewMetricCard icon={<Power className="h-5 w-5" aria-hidden="true" />} label="Активные" value="3" />
        <PreviewMetricCard icon={<UsersIcon className="h-5 w-5" aria-hidden="true" />} label="Категории" value={String(totalCategories)} />
        <PreviewMetricCard
          icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
          label="Без администратора"
          value={String(withoutAdmin)}
          tone={withoutAdmin > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_320px]">
        <Card padded={false} className="min-w-0">
          <PreviewToolbar>
            <PreviewSearchInput placeholder="Поиск по названию или коду…" value={search} onChange={setSearch} />
            <PreviewSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <PreviewSelect label="Город" value={city} onChange={setCity} options={CITY_OPTIONS} />
            <PreviewResetButton
              onClick={() => {
                setSearch('');
                setStatus('all');
                setCity('all');
              }}
            />
          </PreviewToolbar>

          <PreviewTable>
            <PreviewTableHead>
              <PreviewTh>Филиал</PreviewTh>
              <PreviewTh className="w-[160px]">Администратор</PreviewTh>
              <PreviewTh className="w-20">Категории</PreviewTh>
              <PreviewTh className="w-20">Менторы</PreviewTh>
              <PreviewTh className="w-[105px]">Активные задания</PreviewTh>
              <PreviewTh className="w-[100px]">Статус</PreviewTh>
              <PreviewTh className="w-20">Здоровье</PreviewTh>
              <PreviewTh className="w-11" />
            </PreviewTableHead>
            <tbody>
              {rows.map((branch) => (
                <PreviewTr
                  key={branch.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(branch.id, node);
                    else rowRefs.current.delete(branch.id);
                  }}
                  selected={branch.id === highlightBranchId}
                >
                  <PreviewTd className="text-ink">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <PreviewCellStack
                        primary={branch.name}
                        secondary={`${branch.code} · ${formatStreet(branch.address)}`}
                        tooltip={branch.name}
                      />
                    </div>
                  </PreviewTd>
                  <PreviewTd>
                    {branch.adminName ?? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-warning">
                        <StatusDot tone="warning" />
                        Не назначен
                      </span>
                    )}
                  </PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.categoriesCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.mentorsCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.activeAssignments}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${
                        branch.isActive ? 'text-success' : 'text-ink-muted'
                      }`}
                    >
                      <StatusDot tone={branch.isActive ? 'success' : 'neutral'} />
                      {branch.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <HealthValue value={branch.healthPct} />
                  </PreviewTd>
                  <PreviewTd className="text-right">
                    <PreviewActionMenu
                      items={[
                        {
                          label: 'Редактировать',
                          icon: <Pencil className="h-full w-full" aria-hidden="true" />,
                          onClick: () => {
                            showToast('Функция будет подключена позже');
                          },
                        },
                        {
                          label: branch.isActive ? 'Деактивировать' : 'Активировать',
                          icon: <Power className="h-full w-full" aria-hidden="true" />,
                          destructive: branch.isActive,
                          onClick: () => {
                            showToast('Функция будет подключена позже');
                          },
                        },
                      ]}
                    />
                  </PreviewTd>
                </PreviewTr>
              ))}
            </tbody>
          </PreviewTable>
        </Card>

        <SectionCard title="Распределение пользователей по филиалам" className="h-fit self-start" padded>
          <ul className="space-y-4">
            {PREVIEW_BRANCH_USER_DISTRIBUTION.map((entry) => {
              const total = PREVIEW_BRANCH_USER_DISTRIBUTION.reduce((sum, e) => sum + e.count, 0);
              const pct = Math.round((entry.count / total) * 100);
              return (
                <li key={entry.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{entry.label}</span>
                    <span className="font-medium tabular-nums text-ink-secondary">{entry.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <PreviewToast message={toastMessage} />
    </div>
  );
}
