import { useQuery } from '@tanstack/react-query';

import { listAssignments, type AssignmentDto } from '../../api/lead/assignments';
import { isCalendarVisible } from './deadlineEvents';

const PAGE_SIZE = 100;

/** Защита от бесконечного цикла при некорректном `totalCount`: 20 страниц = 2 000 дедлайнов за диапазон. */
const MAX_PAGES = 20;

/**
 * Все дедлайны диапазона `[fromMs, toMs)`, видимые вызывающему. Видимость решает сервер
 * (`AssignmentService.ApplyVisibility` + tenant-фильтр): Mentor получает только свои задания,
 * Lead — своей категории, Branch Admin — своего филиала, Organization Admin — выбранного
 * филиала или всех. Поэтому один и тот же хук обслуживает календари всех ролей.
 *
 * `scopeKey` различает кэш ролей/филиалов; ключ не начинается с `auth`, так что realtime
 * (`isLiveQueryKey`) обновляет календарь при любом изменении заданий.
 */
export function useCalendarDeadlines(
  scopeKey: readonly unknown[],
  fromMs: number,
  toMs: number,
  options: { maxItems?: number } = {},
): { items: AssignmentDto[]; isPending: boolean; error: unknown } {
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;

  const query = useQuery({
    queryKey: [...scopeKey, 'deadline-calendar', fromMs, toMs, Number.isFinite(maxItems) ? maxItems : 'all'],
    queryFn: async () => {
      const dueFrom = new Date(fromMs).toISOString();
      const dueTo = new Date(toMs).toISOString();
      const items: AssignmentDto[] = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await listAssignments({ page, pageSize: PAGE_SIZE, dueFrom, dueTo, sort: 'currentDueAt', order: 'asc' });
        items.push(...result.items.filter(isCalendarVisible));
        if (items.length >= maxItems || page * PAGE_SIZE >= result.totalCount || result.items.length === 0) break;
      }

      return Number.isFinite(maxItems) ? items.slice(0, maxItems) : items;
    },
    staleTime: 30_000,
  });

  return { items: query.data ?? [], isPending: query.isPending, error: query.error };
}
