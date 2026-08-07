import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  Tags,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface AdminNavItem {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  /** Есть ли уже рабочая страница за этим пунктом (остальные — «скоро», раздел 12 сессии). */
  implemented: boolean;
  /**
   * «Филиалы» видит только Organization Admin (ТЗ BRN-006, TEN-003). Branch Admin
   * работает внутри одного фиксированного филиала — тот уже показан read-only в
   * Topbar (`BranchContextBadge`), отдельный пункт навигации дублировал бы контекст.
   */
  organizationAdminOnly?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', label: 'Обзор', path: '/admin/dashboard', icon: LayoutDashboard, implemented: true },
  {
    key: 'branches',
    label: 'Филиалы',
    path: '/admin/branches',
    icon: Building2,
    implemented: true,
    organizationAdminOnly: true,
  },
  { key: 'users', label: 'Пользователи', path: '/admin/users', icon: Users, implemented: true },
  { key: 'categories', label: 'Категории', path: '/admin/categories', icon: Tags, implemented: true },
  { key: 'assignments', label: 'Задания', path: '/admin/assignments', icon: ClipboardList, implemented: true },
  { key: 'reports', label: 'Отчёты', path: '/admin/reports', icon: BarChart3, implemented: true },
  { key: 'audit', label: 'Журнал аудита', path: '/admin/audit', icon: ScrollText, implemented: true },
  { key: 'notifications', label: 'Уведомления', path: '/admin/notifications', icon: Bell, implemented: true },
  { key: 'health', label: 'Состояние системы', path: '/admin/health', icon: Activity, implemented: true },
  // «Настройки» намеренно не в sidebar: раздел UX-рефактора admin shell убрал его
  // отсюда в пользу profile dropdown (см. ProfileMenu.tsx) — маршрут /admin/settings
  // уже подключён и работает через ту точку входа.
];
