import { BarChart3, ClipboardCheck, ClipboardList, LayoutDashboard, Users } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Состав раздела Lead (ТЗ 2.2, раздел 24.4 — «Страницы Lead»), за вычетом
 * «Расписание» и «Предложения» — убраны из интерфейса по запросу (2026-09-25):
 * расписание оказалось не нужно, предложения планировщика решили пока не
 * нагружать интерфейс — сами страницы и связанный backend не удалены,
 * только не выведены в навигацию/маршруты, чтобы можно было безболезненно
 * вернуть при необходимости. `/profile` сюда не входит — он общий для всех
 * ролей (`FE-014`) и живёт вне sidebar.
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
  { key: 'assignments', label: 'Задания', path: '/lead/assignments', icon: ClipboardList },
  { key: 'review-queue', label: 'На проверке', path: '/lead/review-queue', icon: ClipboardCheck },
  { key: 'team', label: 'Команда', path: '/lead/team', icon: Users },
  { key: 'reports', label: 'Отчёты', path: '/lead/reports', icon: BarChart3 },
];
