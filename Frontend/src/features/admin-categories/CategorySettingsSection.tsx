import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../shared/ui/Button';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useCategorySettingsQuery } from './useCategoriesQuery';
import type { PreviewCategoryDetails } from './categoryPresentation';

function SettingRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export interface CategorySettingsSectionProps {
  category: PreviewCategoryDetails;
  canManage: boolean;
  onEdit: () => void;
}

/**
 * Только поля, реально существующие в CategorySettings ТЗ (раздел 8 промпта) — ничего не придумано.
 * `CategorySettingsDto` — отдельный backend-ресурс (`GET /categories/{id}/settings`, свой
 * `concurrencyToken`), загружается по требованию при открытии вкладки, не вместе со списком
 * направлений (иначе N+1 запросов на каждую карточку `/admin/categories`).
 */
export function CategorySettingsSection({ category, canManage, onEdit }: CategorySettingsSectionProps): JSX.Element {
  const settingsQuery = useCategorySettingsQuery(category.id);

  if (settingsQuery.isPending) {
    return <p className="px-1 py-10 text-center text-[13px] text-ink-muted">Загрузка настроек…</p>;
  }

  if (settingsQuery.error !== null || settingsQuery.settings === undefined) {
    return <ErrorState error={settingsQuery.error} title="Не удалось загрузить настройки направления" />;
  }

  const settings = settingsQuery.settings;

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-divider">
        <SettingRow label="Часовой пояс" value={settings.timeZoneId} />
        <SettingRow label="Дедлайн по умолчанию" value={settings.defaultDueTimeLocal} />
        <SettingRow label="Срок до дедлайна" value={`${settings.defaultAssignmentDueDays} дн.`} />
        <SettingRow
          label="Приём работ после дедлайна"
          value={
            <span className={settings.allowLateSubmission ? 'text-success' : 'text-ink-muted'}>
              {settings.allowLateSubmission ? 'Разрешён' : 'Запрещён'}
            </span>
          }
        />
      </dl>
      <p className="text-[12px] leading-[18px] text-ink-muted">
        {settings.allowLateSubmission
          ? 'Ментор может отправить решение после дедлайна — задание переходит в статус «Просрочено», но приём остаётся открыт.'
          : 'После дедлайна отправка решения заблокирована — задание остаётся в статусе «Просрочено» до решения Lead/Admin.'}
      </p>

      {canManage ? (
        <Button variant="secondary" size="sm" leadingIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onEdit}>
          Редактировать настройки
        </Button>
      ) : null}
    </div>
  );
}
