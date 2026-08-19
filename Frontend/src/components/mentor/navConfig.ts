import { Bell, CalendarDays, ClipboardList, History, LayoutDashboard, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Состав раздела Mentor — рабочий процесс «мои задания → отправка решения →
 * обратная связь руководителя → личная аналитика» (ТЗ 2.2, раздел 24.5).
 * Namespace `/mentor/*`, отдельный от Lead-навигации
 * (`components/lead/navConfig.ts`). Mentor исполняет, а не управляет: нет
 * пунктов создания/назначения/проверки — только собственные задания,
 * расписание (чтение), история и отчёт.
 */
export interface MentorNavItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const MENTOR_NAV_ITEMS: MentorNavItem[] = [
  { key: 'dashboard', label: 'Обзор', path: '/mentor/dashboard', icon: LayoutDashboard },
  { key: 'schedule', label: 'Расписание', path: '/mentor/schedule', icon: CalendarDays },
  { key: 'tasks', label: 'Мои задания', path: '/mentor/tasks', icon: ClipboardList },
  { key: 'history', label: 'История', path: '/mentor/history', icon: History },
  { key: 'reports', label: 'Отчёты', path: '/mentor/reports', icon: TrendingUp },
  { key: 'notifications', label: 'Уведомления', path: '/mentor/notifications', icon: Bell },
];
