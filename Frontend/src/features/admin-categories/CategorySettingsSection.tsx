import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '../../shared/ui/Button';
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

/** Только поля, реально существующие в CategorySettings ТЗ (раздел 8 промпта) — ничего не придумано. */
export function CategorySettingsSection({ category, canManage, onEdit }: CategorySettingsSectionProps): JSX.Element {
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-divider">
        <SettingRow label="Часовой пояс" value={category.timezone} />
        <SettingRow label="Дедлайн по умолчанию" value={category.defaultDueTimeLocal} />
        <SettingRow label="Срок до дедлайна" value={`${category.defaultDueDays} дн.`} />
        <SettingRow
          label="Приём работ после дедлайна"
          value={
            <span className={category.allowLateSubmission ? 'text-success' : 'text-ink-muted'}>
              {category.allowLateSubmission ? 'Разрешён' : 'Запрещён'}
            </span>
          }
        />
      </dl>
      <p className="text-[12px] leading-[18px] text-ink-muted">
        {category.allowLateSubmission
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
