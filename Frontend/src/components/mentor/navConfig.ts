import { Bell, CalendarDays, ClipboardList, History, LayoutDashboard, Lightbulb, School, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';

import { PERMISSION } from '../../auth/usePermissions';
import type { Permission } from '../../auth/usePermissions';

/**
 * Состав раздела Mentor — рабочий процесс «мои задания → отправка решения →
 * обратная связь руководителя → личная аналитика» (ТЗ 2.2, раздел 24.5).
 * Namespace `/mentor/*`, отдельный от Lead-навигации
 * (`components/lead/navConfig.ts`). Mentor исполняет, а не управляет: нет
 * пунктов создания/назначения/проверки — только собственные задания,
 * предложения, история и отчёт. «Расписание» убрано из навигации (запрос 2026-10-09, вслед
 * за Lead): страница и backend остаются, только не выведены в меню/маршруты.
 */
export interface MentorNavItem {
  key: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  /** Пункт скрыт, если администратор закрыл это право: страница всё равно ответила бы отказом. */
  permission?: Permission;
}

export const MENTOR_NAV_ITEMS: MentorNavItem[] = [
  { key: 'dashboard', path: '/mentor/dashboard', icon: LayoutDashboard },
  { key: 'tasks', path: '/mentor/tasks', icon: ClipboardList },
  { key: 'proposals', path: '/mentor/proposals', icon: Lightbulb },
  { key: 'calendar', path: '/mentor/calendar', icon: CalendarDays },
  { key: 'history', path: '/mentor/history', icon: History },
  { key: 'reports', path: '/mentor/reports', icon: TrendingUp, permission: PERMISSION.reportsView },
  { key: 'notifications', path: '/mentor/notifications', icon: Bell },
  { key: 'crm', path: '/mentor/crm', icon: School, permission: PERMISSION.crmUse },
];
