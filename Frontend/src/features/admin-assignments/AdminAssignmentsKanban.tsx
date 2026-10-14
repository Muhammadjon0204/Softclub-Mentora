import { AnimatePresence, motion } from 'framer-motion';

import type { AssignmentDto } from '../../api/lead/assignments';
import { Avatar } from '../../shared/ui/Avatar';
import { AnimatedNumber } from '../../shared/ui/motion';
import { SPRING_ITEM, STAGGER_LIMIT } from '../../shared/ui/motionTokens';
import { deadlineHint, formatShortDateTimeRu } from './adminAssignmentView';

interface KanbanColumn {
  id: string;
  title: string;
  statuses: string[];
  dot: string;
}

/** Колонки по статусам; «На проверке» объединяет «Отправлено» и «Взято на проверку». */
const COLUMNS: KanbanColumn[] = [
  { id: 'assigned', title: 'Назначено', statuses: ['Assigned'], dot: 'bg-brand' },
  { id: 'review', title: 'На проверке', statuses: ['Submitted', 'InReview'], dot: 'bg-info' },
  { id: 'rework', title: 'На доработке', statuses: ['NeedsRework'], dot: 'bg-warning' },
  { id: 'overdue', title: 'Просрочено', statuses: ['Overdue'], dot: 'bg-danger' },
  { id: 'approved', title: 'Одобрено', statuses: ['Approved'], dot: 'bg-success' },
];

const HINT_TONE = { muted: 'text-ink-muted', warning: 'text-warning', danger: 'text-danger' } as const;

interface AdminAssignmentsKanbanProps {
  items: AssignmentDto[];
  mentorOf: (item: AssignmentDto) => string;
  categoryOf: (item: AssignmentDto) => string | undefined;
  selectedId: string | null;
  onOpen: (id: string) => void;
}

/**
 * Канбан для администратора — только обзор. Статус задания меняют участники процесса
 * (ментор сдаёт, руководитель проверяет), поэтому перетаскивания между колонками здесь нет:
 * доска показывает, где что лежит, а клик открывает карточку задания.
 */
export function AdminAssignmentsKanban({ items, mentorOf, categoryOf, selectedId, onOpen }: AdminAssignmentsKanbanProps): JSX.Element {
  const now = Date.now();

  return (
    <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-4 sm:px-6 [scrollbar-width:thin]">
      {COLUMNS.map((column, columnIndex) => {
        const cards = items.filter((item) => column.statuses.includes(item.status));
        return (
          <motion.section
            key={column.id}
            aria-label={column.title}
            className="flex w-[268px] shrink-0 flex-col rounded-card bg-surface-muted p-2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_ITEM, delay: columnIndex * 0.045 }}
          >
            <header className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className={`h-2 w-2 rounded-full ${column.dot}`} aria-hidden="true" />
                {column.title}
              </span>
              <AnimatedNumber value={cards.length} className="rounded-full bg-surface px-2 text-[12px] font-semibold tabular-nums text-ink-secondary" />
            </header>

            <motion.ul layout className="flex min-h-[72px] flex-col gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {cards.map((item, index) => {
                  const due = formatShortDateTimeRu(item.currentDueAt);
                  const hint = deadlineHint(item.status, Date.parse(item.currentDueAt), now);
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ ...SPRING_ITEM, delay: index < STAGGER_LIMIT ? 0.1 + index * 0.03 : 0 }}
                    >
                      <motion.button
                        type="button"
                        onClick={() => { onOpen(item.id); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        transition={SPRING_ITEM}
                        className={`block w-full rounded-control border bg-surface p-3 text-left shadow-surface transition-[border-color,box-shadow] hover:shadow-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                          item.id === selectedId ? 'border-brand' : 'border-line'
                        }`}
                      >
                        <span className="line-clamp-2 text-[13px] font-medium leading-[18px] text-ink">{item.title}</span>
                        <span className="mt-2 flex min-w-0 items-center gap-2">
                          <Avatar name={mentorOf(item)} size="xs" />
                          <span className="min-w-0 truncate text-[12px] text-ink-secondary">{mentorOf(item)}</span>
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-2 border-t border-divider pt-2 text-[11.5px]">
                          <span className="truncate text-ink-muted">{categoryOf(item) ?? 'Направление'}</span>
                          <span className={`shrink-0 tabular-nums ${hint !== null ? HINT_TONE[hint.tone] : 'text-ink-muted'}`}>
                            {due.date}
                          </span>
                        </span>
                      </motion.button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {cards.length === 0 ? (
                <li className="grid min-h-[72px] place-items-center rounded-control border border-dashed border-line text-[12px] text-ink-disabled">Пусто</li>
              ) : null}
            </motion.ul>
          </motion.section>
        );
      })}
    </div>
  );
}
