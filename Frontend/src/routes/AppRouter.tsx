import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { dashboardPathForRole } from '../auth/roleRedirect';
import { useAuth } from '../auth/useAuth';
import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { AdminLayout } from '../layouts/AdminLayout';
import { LeadLayout } from '../layouts/LeadLayout';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { SetPasswordPage } from '../pages/auth/SetPasswordPage';
import { DashboardPlaceholder } from '../pages/dashboard/DashboardPlaceholder';
import { AssignmentsPage } from '../pages/admin/AssignmentsPage';
import { AuditPage } from '../pages/admin/AuditPage';
import { BranchesPage } from '../pages/admin/BranchesPage';
import { CategoriesPage } from '../pages/admin/CategoriesPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { HealthPage } from '../pages/admin/HealthPage';
import { NotificationsPage } from '../pages/admin/NotificationsPage';
import { ReportsPage } from '../pages/admin/ReportsPage';
import { SettingsPage } from '../pages/admin/SettingsPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { DashboardPage as LeadDashboardPage } from '../pages/lead/DashboardPage';
import { SchedulePage as LeadSchedulePage } from '../pages/lead/SchedulePage';
import { SuggestionsPage as LeadSuggestionsPage } from '../pages/lead/SuggestionsPage';
import { AssignmentsPage as LeadAssignmentsPage } from '../pages/lead/AssignmentsPage';
import { ReviewQueuePage as LeadReviewQueuePage } from '../pages/lead/ReviewQueuePage';
import { TeamPage as LeadTeamPage } from '../pages/lead/TeamPage';
import { ReportsPage as LeadReportsPage } from '../pages/lead/ReportsPage';

/** Аутентифицированному на /login делать нечего — уводим на его дашборд. */
function RedirectIfAuthenticated({ children }: { children: ReactNode }): JSX.Element {
  const { status, user } = useAuth();

  // Пока bootstrap не завершён — никаких redirect.
  if (status === 'bootstrapping') return <AuthBootstrapScreen />;
  if (user !== null) return <Navigate to={dashboardPathForRole(user.role)} replace />;

  return <>{children}</>;
}

function HomeRedirect(): JSX.Element {
  const { status, user } = useAuth();

  if (status === 'bootstrapping') return <AuthBootstrapScreen />;
  if (user === null) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardPathForRole(user.role)} replace />;
}

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      {/*
        Публичные auth-маршруты. RequireAuth к ним НЕ применяется.
        Публичной регистрации в системе нет — маршрута /register не существует.
      */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* Admin-панель: layout + branch context общие для всех разделов. Разделы ниже —
          визуальные UI-прототипы (сессия быстрых превью): без реального backend,
          CRUD и валидации — см. src/mocks/ui-preview. Detail-роуты (/admin/users/:id
          и т.п.) сознательно не создаются на этом этапе. */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireRole allowed={['Admin']}>
              <AdminLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Lead-панель (Phase 3, ТЗ 2.2 раздел 24.4): единый `/lead/*`, ровно маршруты
          из таблицы «Страницы Lead» — никаких `/lead-panel/*` или иных вариантов
          (тот же принцип, что `FE-030` закрепляет для `/admin/*`). Detail-роуты
          не заводятся — `?assignmentId=`/`?mentorId=`/`?topicId=` + drawer, тот же
          приём, что уже применён в разделе `/admin/*`. */}
      <Route
        path="/lead"
        element={
          <RequireAuth>
            <RequireRole allowed={['Lead']}>
              <LeadLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<LeadDashboardPage />} />
        <Route path="schedule" element={<LeadSchedulePage />} />
        <Route path="suggestions" element={<LeadSuggestionsPage />} />
        <Route path="assignments" element={<LeadAssignmentsPage />} />
        <Route path="review-queue" element={<LeadReviewQueuePage />} />
        <Route path="team" element={<LeadTeamPage />} />
        <Route path="reports" element={<LeadReportsPage />} />
      </Route>

      {/* Защищённый маршрут-заглушка: Mentor проектируется отдельным этапом. */}
      <Route
        path="/mentor/dashboard"
        element={
          <RequireAuth>
            <RequireRole allowed={['Mentor']}>
              <DashboardPlaceholder title="Дашборд ментора" />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
