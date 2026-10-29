import { useQuery } from '@tanstack/react-query';
import { Shuffle, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { listAssignments, type AssignmentDto } from '../../api/lead/assignments';
import { LEAD_ASSIGNMENT_STATUS_LABEL, type LeadAssignmentStatus } from '../../mocks/ui-preview/leadAssignments.preview';
import { ConfirmDialog } from '../../shared/overlays';
import { FormCheckbox, FormField, FormSelect, FormTextarea } from '../../shared/ui/FormField';
import { useCategoriesForBranch } from '../admin-categories/useCategoriesQuery';
import type { PreviewUserDetails } from './userPresentation';
import { intlLocale } from '../../shared/i18n/intl';

export interface ChangeCategoryInput {
  newCategoryId: string;
  newCategoryName: string;
  reason: string;
  /** Незавершённые задания, которые администратор согласился отменить перед переводом. */
  assignmentsToCancel: AssignmentDto[];
  /**
   * Филиал пользователя как явный X-MTF-Branch-Id — только для Organization Admin: в контексте
   * «Все филиалы» запись без филиала отклоняется, а Branch Admin заголовок слать не вправе.
   */
  branchOverride: string | null;
}

export interface ChangeCategoryDialogProps {
  user: PreviewUserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOrgAdmin: boolean;
  isSubmitting: boolean;
  onConfirm: (input: ChangeCategoryInput) => Promise<void>;
}

const REASON_MIN = 5;
const REASON_MAX = 500;
const FINISHED = new Set(['Approved', 'Cancelled']);

function formatDue(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Перевод ментора или тимлида в другое направление того же филиала
 * (`POST /users/{id}/change-category`, Branch Admin и Organization Admin).
 *
 * Сервер не переводит человека с незавершёнными заданиями (`USER-012`): они остались бы
 * в старой команде без исполнителя. Поэтому диалог сам показывает эти задания и даёт
 * отменить их здесь же одной галочкой — или закрыть и попросить тимлида переназначить.
 * Активного тимлида сервер не переводит вовсе (`USER-013`), и диалог объясняет, что сделать.
 */
export function ChangeCategoryDialog({ user, open, onOpenChange, isOrgAdmin, isSubmitting, onConfirm }: ChangeCategoryDialogProps): JSX.Element {
  const [categoryId, setCategoryId] = useState('');
  const [reason, setReason] = useState('');
  const [cancelPending, setCancelPending] = useState(false);

  useEffect(() => {
    if (!open || user === null) return;
    setCategoryId('');
    setReason('');
    setCancelPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- черновик сбрасывается только при открытии на конкретного пользователя
  }, [open, user?.id]);

  const categoriesQuery = useCategoriesForBranch(user?.branchId ?? null, isOrgAdmin);
  const otherCategories = categoriesQuery.categories.filter((category) => category.id !== user?.categoryId);

  const pendingQuery = useQuery({
    queryKey: ['admin-user-pending-assignments', user?.id ?? 'none'],
    queryFn: () => listAssignments({ assignedToId: user?.id, pageSize: 100, sort: 'currentDueAt', order: 'asc' }),
    enabled: open && user !== null && user.role === 'Mentor',
  });
  const pending = useMemo(
    () => (pendingQuery.data?.items ?? []).filter((assignment) => assignment.assignedToId === user?.id && !FINISHED.has(assignment.status)),
    [pendingQuery.data, user?.id],
  );

  const isLead = user?.role === 'Lead';
  const reasonTrimmed = reason.trim();
  const reasonInvalid = reasonTrimmed.length < REASON_MIN || reasonTrimmed.length > REASON_MAX;
  const pendingUnresolved = pending.length > 0 && !cancelPending;
  const confirmDisabled =
    user === null || isLead || categoryId.length === 0 || reasonInvalid || pendingQuery.isPending || pendingUnresolved;

  const target = otherCategories.find((category) => category.id === categoryId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Сменить направление"
      icon={<Shuffle className="h-[18px] w-[18px]" aria-hidden="true" />}
      confirmLabel={pending.length > 0 && cancelPending ? `Отменить ${pending.length} и перевести` : 'Перевести'}
      loading={isSubmitting}
      confirmDisabled={confirmDisabled}
      tone={pending.length > 0 ? 'warning' : 'default'}
      onConfirm={async () => {
        if (user === null || target === undefined) return;
        await onConfirm({
          newCategoryId: target.id,
          newCategoryName: target.name,
          reason: reasonTrimmed,
          assignmentsToCancel: cancelPending ? pending : [],
          branchOverride: isOrgAdmin ? user.branchId : null,
        });
        onOpenChange(false);
      }}
      description={
        <>
          <span className="font-medium text-ink">{user?.fullName}</span> · сейчас: {user?.categoryName ?? 'без направления'}
          {user !== null ? `, ${user.branchName}` : ''}
        </>
      }
      details={
        isLead ? (
          <div className="flex gap-3 rounded-control border border-warning-border bg-warning-soft p-3.5 text-[13px] leading-5 text-ink">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              Это действующий тимлид направления «{user?.categoryName}». Без тимлида команда останется без проверки заданий, поэтому
              напрямую перевести его нельзя. Сначала назначьте направлению нового тимлида (раздел «Категории») или смените этому
              пользователю роль на «Ментор» — затем переведите.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Новое направление" htmlFor="change-category-target" required>
              <FormSelect
                id="change-category-target"
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder={categoriesQuery.isPending ? 'Загрузка…' : otherCategories.length === 0 ? 'В филиале нет других направлений' : 'Выберите направление'}
                options={otherCategories.map((category) => ({ value: category.id, label: category.name }))}
              />
            </FormField>

            {pending.length > 0 ? (
              <div className="space-y-2.5 rounded-control border border-warning-border bg-warning-soft p-3.5">
                <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  Незавершённые задания: {pending.length}
                </p>
                <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {pending.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate text-ink">{assignment.title}</span>
                      <span className="shrink-0 tabular-nums text-ink-muted">
                        {LEAD_ASSIGNMENT_STATUS_LABEL[assignment.status as LeadAssignmentStatus] ?? assignment.status} · {formatDue(assignment.currentDueAt)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] leading-[17px] text-ink-secondary">
                  Задания остались бы в старой команде без исполнителя. Отмените их здесь — или закройте окно и попросите тимлида
                  «{user?.categoryName}» переназначить их другим менторам.
                </p>
                <FormCheckbox
                  id="change-category-cancel-pending"
                  label={`Отменить ${pending.length} незавершённых заданий`}
                  description="Отмену нельзя вернуть; причина попадёт в историю заданий"
                  checked={cancelPending}
                  onChange={(event) => { setCancelPending(event.target.checked); }}
                />
              </div>
            ) : null}

            <FormField
              label="Причина"
              htmlFor="change-category-reason"
              required
              hint="От 5 до 500 символов — попадает в журнал аудита"
              error={reason.length > 0 && reasonInvalid ? 'От 5 до 500 символов' : undefined}
            >
              <FormTextarea
                id="change-category-reason"
                value={reason}
                onChange={(event) => { setReason(event.target.value); }}
                invalid={reason.length > 0 && reasonInvalid}
                placeholder="Например: переходит в команду AI"
              />
            </FormField>

            <ul className="space-y-1.5 text-[12px] leading-[17px] text-ink-secondary">
              <li>· Филиал не меняется — только команда</li>
              <li>· Новые задания будет назначать тимлид новой команды</li>
              <li>· Пользователь выйдет из системы и войдёт заново уже в новой команде</li>
              <li>· История и принятые задания остаются в прежней команде</li>
            </ul>
          </div>
        )
      }
    />
  );
}
