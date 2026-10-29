import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  PlugZap,
  ScrollText,
  Tags,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface AdminNavItem {
  key: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  /** Есть ли уже рабочая страница за этим пунктом (остальные — «скоро», раздел 12 сессии). */
  implemented: boolean;
  /**
   * «Филиалы» видит только Organization Admin (ТЗ BRN-006, TEN-003). Branch Admin
   * работает внутри одного фиксированного филиала — тот уже показан в меню профиля
   * (`ProfileMenu`), отдельный пункт навигации дублировал бы контекст.
   */
  organizationAdminOnly?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', path: '/admin/dashboard', icon: LayoutDashboard, implemented: true },
  {
    key: 'branches',
    path: '/admin/branches',
    icon: Building2,
    implemented: true,
    organizationAdminOnly: true,
  },
  { key: 'users', path: '/admin/users', icon: Users, implemented: true },
  { key: 'categories', path: '/admin/categories', icon: Tags, implemented: true },
  { key: 'assignments', path: '/admin/assignments', icon: ClipboardList, implemented: true },
  { key: 'calendar', path: '/admin/calendar', icon: CalendarDays, implemented: true },
  { key: 'reports', path: '/admin/reports', icon: BarChart3, implemented: true },
  { key: 'audit', path: '/admin/audit', icon: ScrollText, implemented: true },
  { key: 'notifications', path: '/admin/notifications', icon: Bell, implemented: true },
  { key: 'health', path: '/admin/health', icon: Activity, implemented: true },
  {
    key: 'crm',
    path: '/admin/integrations/crm',
    icon: PlugZap,
    implemented: true,
    // Админ организации видит здесь подключение, все группы и связи; админ филиала — группы своего
    // филиала (сервер сам отдаёт только их).
  },
  // «Настройки» намеренно не в sidebar: раздел UX-рефактора admin shell убрал его
  // отсюда в пользу profile dropdown (см. ProfileMenu.tsx) — маршрут /admin/settings
  // уже подключён и работает через ту точку входа.
];
