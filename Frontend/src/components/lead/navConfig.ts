import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, LayoutDashboard, Lightbulb, Users } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Состав раздела Lead (ТЗ 2.2, раздел 24.4 — «Страницы Lead»). Ровно те
 * маршруты, что перечислены в таблице ТЗ: обзор, расписание, предложения
 * планировщика, задания, очередь проверки, команда, отчёты. `/profile` сюда
 * не входит — он общий для всех ролей (`FE-014`) и живёт вне sidebar.
 *
 * Namespace `/lead/*` — тот же, что уже зарезервирован в `AppRouter` (раздел
 * 24.3 `FE-030` не запрещает `/lead/*`, только новые `/admin`-варианты).
 * Никакой Organization-management пункт (Филиалы/Пользователи организации/
 * системные Категории/System Health/Настройки организации/глобальный Audit)
 * сюда не входит — Lead не является администратором (раздел 8.3 ТЗ).
 */
export interface LeadNavItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const LEAD_NAV_ITEMS: LeadNavItem[] = [
  { key: 'dashboard', label: 'Обзор', path: '/lead/dashboard', icon: LayoutDashboard },
  { key: 'schedule', label: 'Расписание', path: '/lead/schedule', icon: CalendarDays },
  { key: 'suggestions', label: 'Предложения', path: '/lead/suggestions', icon: Lightbulb },
  { key: 'assignments', label: 'Задания', path: '/lead/assignments', icon: ClipboardList },
  { key: 'review-queue', label: 'На проверке', path: '/lead/review-queue', icon: ClipboardCheck },
  { key: 'team', label: 'Команда', path: '/lead/team', icon: Users },
  { key: 'reports', label: 'Отчёты', path: '/lead/reports', icon: BarChart3 },
];
