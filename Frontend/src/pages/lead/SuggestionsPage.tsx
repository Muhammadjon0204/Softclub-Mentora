import { CalendarClock, Check, Lightbulb, Pencil, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { PreviewActionMenu } from '../../features/admin-preview/PreviewActionMenu';
import type { PreviewActionMenuItem } from '../../features/admin-preview/PreviewActionMenu';
import { PreviewPageHeader } from '../../features/admin-preview/PreviewPageHeader';
import { AssignmentCancelDialog } from '../../features/lead-assignments/AssignmentCancelDialog';
import { AssignmentFormDrawer } from '../../features/lead-assignments/AssignmentFormDrawer';
import type { AssignmentFormDrawerState } from '../../features/lead-assignments/AssignmentFormDrawer';
import { sourceLabel } from '../../features/lead/assignments/leadAssignmentPresentation';
import { useAssignmentActions } from '../../features/lead/assignments/useAssignmentActions';
import { formatCategoryDateTime } from '../../features/lead/scope/leadDateFormat';
import { useLeadMentorNameResolver } from '../../features/lead/scope/useScopedLeadMentors';
import { useLeadScope } from '../../features/lead/scope/useLeadScope';
import { useScopedLeadAssignments } from '../../features/lead/scope/useScopedLeadAssignments';
import { useToast } from '../../shared/overlays';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';
import { EmptyState } from '../../shared/ui/EmptyState';
import type { LeadAssignmentRecord } from '../../mocks/ui-preview/leadAssignments.preview';

function initialsOf(fullName: string): string {
  return fullName.split(' ').slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

/**
 * `/lead/suggestions` (ТЗ 2.2, раздел 24.4) — очередь предложений планировщика
 * (`Status='Suggested'`, `Source='Auto'`). Lead обязан явно принять, отредактировать
 * перед принятием или отклонить с причиной (раздел 20.7 ТЗ) — карточный список,
 * а не таблица: элементов обычно немного, и решение принимается по каждому отдельно.
 */
export function SuggestionsPage(): JSX.Element {
  const scope = useLeadScope();
  const toast = useToast();
  const assignments = useScopedLeadAssignments();
  const mentorNameOf = useLeadMentorNameResolver();
  const actions = useAssignmentActions();
  const suggestions = assignments.filter((a) => a.status === 'Suggested');

  const [formDrawer, setFormDrawer] = useState<AssignmentFormDrawerState | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeadAssignmentRecord | null>(null);

  function accept(a: LeadAssignmentRecord): void {
    actions.acceptSuggestion(a.id, a.concurrencyToken ?? '')
      .then(() => { toast.success('Предложение принято, задание опубликовано'); })
      .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось принять предложение'); });
  }

  /** Тот же паттерн, что у карточек Kanban `/lead/assignments` (`buildActionItems` в `AssignmentsPage`) — все действия строки, включая «Принять», в одном ⋯-меню, без отдельных кнопок. */
  function buildActionItems(a: LeadAssignmentRecord): PreviewActionMenuItem[] {
    return [
      { label: 'Принять', icon: <Check className="h-full w-full" aria-hidden="true" />, onClick: () => { accept(a); } },
      { label: 'Редактировать', icon: <Pencil className="h-full w-full" aria-hidden="true" />, onClick: () => { setFormDrawer({ mode: 'edit', assignmentId: a.id }); } },
      { label: 'Отклонить', icon: <X className="h-full w-full" aria-hidden="true" />, destructive: true, onClick: () => { setRejectTarget(a); } },
    ];
  }

  return (
    <div className="space-y-6">
      <PreviewPageHeader
        title="Предложения"
        subtitle={`${scope.categoryName} · ${scope.branchDisplayName} — автоматически сгенерированные задания по расписанию`}
      />

      {suggestions.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Lightbulb className="h-5 w-5" aria-hidden="true" />}
            title="Нет новых предложений"
            description="Планировщик формирует предложения каждое утро по расписанию направления — сюда попадут задания, ожидающие вашего решения."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((a) => (
            <Card
              key={a.id}
              padded={false}
              className="relative grid h-full grid-rows-[auto_auto_auto_auto_1fr_auto] p-5 outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-surface-hover"
            >
              <div className="absolute right-4 top-4">
                <PreviewActionMenu items={buildActionItems(a)} />
              </div>

              {/* Ряд 1 (шапка) — аватар фиксированного размера, высота ряда не варьируется. */}
              <span className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                {initialsOf(mentorNameOf(a.mentorId))}
              </span>

              {/* Ряд 2 (заголовок) — `min-h` резервирует высоту ровно под 2 строки (leading-5 = 20px × 2) независимо
                  от фактической длины текста, поэтому ряды 3–6 у всех карточек в одной строке grid стартуют
                  с одинакового Y, а не «съезжают» вверх при однострочном заголовке. */}
              <p className="mb-1.5 line-clamp-2 min-h-[40px] pr-9 text-[15px] font-semibold leading-5 text-ink" title={a.title}>
                {a.title}
              </p>

              {/* Ряд 3 (автор) — одна строка, длинное имя обрезается многоточием, а не переносится. */}
              <p className="mb-2 truncate text-[12.5px] font-medium text-ink-secondary">
                {mentorNameOf(a.mentorId)}
              </p>

              {/* Ряд 4 (тег источника) — `Badge` сам гарантирует `whitespace-nowrap`/`w-fit` (тот же фикс, что и для статусов на «Расписании»/«Команде»). */}
              <Badge tone={a.source === 'Auto' ? 'info' : 'neutral'} className="gap-1">
                {a.source === 'Auto' ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : null}
                {sourceLabel(a.source)}
              </Badge>

              {/* Ряд 5 — не рендерится: явно `1fr` в grid-rows выше, пустой ряд поглощает остаток высоты
                  и выравнивает низ карточек в одной строке между собой (align-items: stretch — поведение
                  grid по умолчанию). Ряд 6 явно закреплён под футер, чтобы не «съехать» в пустой 5-й ряд. */}

              {/* Ряд 6 (футер) — всегда внизу карточки благодаря ряду 5 перед ним. */}
              <div className="row-start-6 flex items-center gap-1.5 border-t border-divider pt-3 text-[12px] text-ink-muted">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Дедлайн: {formatCategoryDateTime(a.currentDueAt, scope.timeZoneId)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AssignmentFormDrawer state={formDrawer} onClose={() => { setFormDrawer(null); }} />

      <AssignmentCancelDialog
        open={rejectTarget !== null}
        onOpenChange={(next) => { if (!next) setRejectTarget(null); }}
        title="Отклонить предложение"
        assignmentTitle={rejectTarget?.title ?? ''}
        confirmLabel="Отклонить"
        onConfirm={(reason) => {
          if (rejectTarget === null) return;
          // ASN-012: отклонить предложение — это отменить его тем же POST /assignments/{id}/cancel.
          actions.cancel(rejectTarget.id, rejectTarget.concurrencyToken ?? '', reason)
            .then(() => { toast.success('Предложение отклонено'); })
            .catch((error: unknown) => { toast.error(error instanceof Error ? error.message : 'Не удалось отклонить предложение'); });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}
