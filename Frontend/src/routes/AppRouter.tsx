import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { dashboardPathForRole } from '../auth/roleRedirect';
import { useAuth } from '../auth/useAuth';
import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { AdminLayout } from '../layouts/AdminLayout';
import { LeadLayout } from '../layouts/LeadLayout';
import { MentorLayout } from '../layouts/MentorLayout';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { SetPasswordPage } from '../pages/auth/SetPasswordPage';
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
import { AssignmentsPage as LeadAssignmentsPage } from '../pages/lead/AssignmentsPage';
import { ReviewQueuePage as LeadReviewQueuePage } from '../pages/lead/ReviewQueuePage';
import { TeamPage as LeadTeamPage } from '../pages/lead/TeamPage';
import { ReportsPage as LeadReportsPage } from '../pages/lead/ReportsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { DashboardPage as MentorDashboardPage } from '../pages/mentor/DashboardPage';
import { SchedulePage as MentorSchedulePage } from '../pages/mentor/SchedulePage';
import { AssignmentsPage as MentorAssignmentsPage } from '../pages/mentor/AssignmentsPage';
import { HistoryPage as MentorHistoryPage } from '../pages/mentor/HistoryPage';
import { ReportsPage as MentorReportsPage } from '../pages/mentor/ReportsPage';
import { NotificationsPage as MentorNotificationsPage } from '../pages/mentor/NotificationsPage';

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

      {/* Admin-панель: layout + branch context общие для всех разделов. Все разделы ниже
          подключены к реальному backend (GET/POST через api/admin/*, useUsersQuery и т.д.) —
          src/mocks/ui-preview держит только общие shape-типы и label-словари, не данные.
          Detail-роуты (/admin/users/:id и т.п.) сознательно не создаются: детали открываются
          через ?entityId= + Drawer. */}
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
        <Route path="profile" element={<ProfilePage />} />
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
        <Route path="assignments" element={<LeadAssignmentsPage />} />
        <Route path="review-queue" element={<LeadReviewQueuePage />} />
        <Route path="team" element={<LeadTeamPage />} />
        <Route path="reports" element={<LeadReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Mentor-панель: тот же приём, что `/lead/*` — единый `/mentor/*`, ровно
          маршруты из навигации `MENTOR_NAV_ITEMS` (ТЗ 2.2, раздел 24.5: Mentor
          исполняет назначенные Lead задания, а не управляет ими). Detail-роуты
          не заводятся — `?assignmentId=`/`?topicId=` + drawer. */}
      <Route
        path="/mentor"
        element={
          <RequireAuth>
            <RequireRole allowed={['Mentor']}>
              <MentorLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<MentorDashboardPage />} />
        <Route path="schedule" element={<MentorSchedulePage />} />
        <Route path="tasks" element={<MentorAssignmentsPage />} />
        <Route path="history" element={<MentorHistoryPage />} />
        <Route path="reports" element={<MentorReportsPage />} />
        <Route path="notifications" element={<MentorNotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
