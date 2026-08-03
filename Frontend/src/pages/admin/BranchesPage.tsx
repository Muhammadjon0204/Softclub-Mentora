import { Building2, Pencil, Plus, Power, Users as UsersIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewMetricCard } from '../../features/admin-preview/PreviewMetricCard';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { PreviewTable, PreviewTableHead, PreviewTd, PreviewTh, PreviewTr } from '../../features/admin-preview/PreviewTable';
import { PreviewResetButton, PreviewSearchInput, PreviewSelect, PreviewToolbar } from '../../features/admin-preview/PreviewToolbar';
import { PreviewToast, usePreviewToast } from '../../features/admin-preview/PreviewToast';
import { PREVIEW_BRANCHES, PREVIEW_BRANCH_USER_DISTRIBUTION } from '../../mocks/ui-preview/branches.preview';
import { Badge } from '../../shared/ui/Badge';
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

function healthTone(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 90) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
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
                <PreviewTr key={branch.id}>
                  <PreviewTd className="text-ink">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-ink" title={branch.name}>
                            {branch.name}
                          </span>
                          {branch.isHeadOffice ? <Badge tone="brand">Главный офис</Badge> : null}
                        </div>
                        <p className="truncate text-xs text-ink-muted">
                          {branch.code} · {branch.address}
                        </p>
                      </div>
                    </div>
                  </PreviewTd>
                  <PreviewTd>
                    {branch.adminName ?? <Badge tone="warning">Не назначен</Badge>}
                  </PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.categoriesCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.mentorsCount}</PreviewTd>
                  <PreviewTd className="tabular-nums">{branch.activeAssignments}</PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <Badge tone={branch.isActive ? 'success' : 'neutral'}>{branch.isActive ? 'Активен' : 'Неактивен'}</Badge>
                  </PreviewTd>
                  <PreviewTd className="whitespace-nowrap">
                    <Badge tone={healthTone(branch.healthPct)}>{branch.healthPct}%</Badge>
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
          <ul className="space-y-3.5">
            {PREVIEW_BRANCH_USER_DISTRIBUTION.map((entry) => {
              const total = PREVIEW_BRANCH_USER_DISTRIBUTION.reduce((sum, e) => sum + e.count, 0);
              const pct = Math.round((entry.count / total) * 100);
              return (
                <li key={entry.label}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-ink-secondary">{entry.label}</span>
                    <span className="font-semibold tabular-nums text-ink">{entry.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
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
