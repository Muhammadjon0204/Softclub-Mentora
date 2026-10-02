import type { ComponentType, ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { dashboardPathForRole } from '../auth/roleRedirect';
import { useAuth } from '../auth/useAuth';
import { AuthBootstrapScreen } from '../components/auth/AuthBootstrapScreen';
import { AdminLayout } from '../layouts/AdminLayout';
import { LeadLayout } from '../layouts/LeadLayout';
import { MentorLayout } from '../layouts/MentorLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { lazyPage } from './lazyPage';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { PageSuspense, PreloadPages } from './RouteSuspense';

// Every page below is fetched when first opened, so a Mentor never downloads the Admin dashboard's
// charts and the login screen arrives without any of them. Each role warms up its own pages when the
// browser is idle (PreloadPages), so navigating inside a section stays instant. LoginPage is the one
// eager page: it is the first screen of most visits.
const ForgotPasswordPage = lazyPage(() => import('../pages/auth/ForgotPasswordPage'), (m) => m.ForgotPasswordPage);
const ResetPasswordPage = lazyPage(() => import('../pages/auth/ResetPasswordPage'), (m) => m.ResetPasswordPage);
const SetPasswordPage = lazyPage(() => import('../pages/auth/SetPasswordPage'), (m) => m.SetPasswordPage);
const ProfilePage = lazyPage(() => import('../pages/ProfilePage'), (m) => m.ProfilePage);

const AdminDashboardPage = lazyPage(() => import('../pages/admin/DashboardPage'), (m) => m.DashboardPage);
const AdminBranchesPage = lazyPage(() => import('../pages/admin/BranchesPage'), (m) => m.BranchesPage);
const AdminUsersPage = lazyPage(() => import('../pages/admin/UsersPage'), (m) => m.UsersPage);
const AdminCategoriesPage = lazyPage(() => import('../pages/admin/CategoriesPage'), (m) => m.CategoriesPage);
const AdminAssignmentsPage = lazyPage(() => import('../pages/admin/AssignmentsPage'), (m) => m.AssignmentsPage);
const AdminReportsPage = lazyPage(() => import('../pages/admin/ReportsPage'), (m) => m.ReportsPage);
const AdminAuditPage = lazyPage(() => import('../pages/admin/AuditPage'), (m) => m.AuditPage);
const AdminNotificationsPage = lazyPage(() => import('../pages/admin/NotificationsPage'), (m) => m.NotificationsPage);
const AdminHealthPage = lazyPage(() => import('../pages/admin/HealthPage'), (m) => m.HealthPage);
const AdminSettingsPage = lazyPage(() => import('../pages/admin/SettingsPage'), (m) => m.SettingsPage);

const LeadDashboardPage = lazyPage(() => import('../pages/lead/DashboardPage'), (m) => m.DashboardPage);
const LeadAssignmentsPage = lazyPage(() => import('../pages/lead/AssignmentsPage'), (m) => m.AssignmentsPage);
const LeadReviewQueuePage = lazyPage(() => import('../pages/lead/ReviewQueuePage'), (m) => m.ReviewQueuePage);
const LeadTeamPage = lazyPage(() => import('../pages/lead/TeamPage'), (m) => m.TeamPage);
const LeadReportsPage = lazyPage(() => import('../pages/lead/ReportsPage'), (m) => m.ReportsPage);

const MentorDashboardPage = lazyPage(() => import('../pages/mentor/DashboardPage'), (m) => m.DashboardPage);
const MentorSchedulePage = lazyPage(() => import('../pages/mentor/SchedulePage'), (m) => m.SchedulePage);
const MentorAssignmentsPage = lazyPage(() => import('../pages/mentor/AssignmentsPage'), (m) => m.AssignmentsPage);
const MentorHistoryPage = lazyPage(() => import('../pages/mentor/HistoryPage'), (m) => m.HistoryPage);
const MentorReportsPage = lazyPage(() => import('../pages/mentor/ReportsPage'), (m) => m.ReportsPage);
const MentorNotificationsPage = lazyPage(() => import('../pages/mentor/NotificationsPage'), (m) => m.NotificationsPage);

const ADMIN_PAGES = [
  AdminDashboardPage, AdminBranchesPage, AdminUsersPage, AdminCategoriesPage, AdminAssignmentsPage,
  AdminReportsPage, AdminAuditPage, AdminNotificationsPage, AdminHealthPage, AdminSettingsPage, ProfilePage,
];
const LEAD_PAGES = [LeadDashboardPage, LeadAssignmentsPage, LeadReviewQueuePage, LeadTeamPage, LeadReportsPage, ProfilePage];
const MENTOR_PAGES = [
  MentorDashboardPage, MentorSchedulePage, MentorAssignmentsPage, MentorHistoryPage, MentorReportsPage,
  MentorNotificationsPage, ProfilePage,
];

function page(Page: ComponentType): JSX.Element {
  return (
    <RouteErrorBoundary>
      <PageSuspense>
        <Page />
      </PageSuspense>
    </RouteErrorBoundary>
  );
}

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
      <Route path="/forgot-password" element={page(ForgotPasswordPage)} />
      <Route path="/reset-password" element={page(ResetPasswordPage)} />
      <Route path="/set-password" element={page(SetPasswordPage)} />

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
              <PreloadPages pages={ADMIN_PAGES} />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={page(AdminDashboardPage)} />
        <Route path="branches" element={page(AdminBranchesPage)} />
        <Route path="users" element={page(AdminUsersPage)} />
        <Route path="categories" element={page(AdminCategoriesPage)} />
        <Route path="assignments" element={page(AdminAssignmentsPage)} />
        <Route path="reports" element={page(AdminReportsPage)} />
        <Route path="audit" element={page(AdminAuditPage)} />
        <Route path="notifications" element={page(AdminNotificationsPage)} />
        <Route path="health" element={page(AdminHealthPage)} />
        <Route path="settings" element={page(AdminSettingsPage)} />
        <Route path="profile" element={page(ProfilePage)} />
      </Route>

      {/* Lead-панель (Phase 3, ТЗ 2.2 раздел 24.4): единый `/lead/*` — никаких
          `/lead-panel/*` или иных вариантов (тот же принцип, что `FE-030`
          закрепляет для `/admin/*`). Detail-роуты не заводятся —
          `?assignmentId=`/`?mentorId=`/`?topicId=` + drawer, тот же приём, что
          уже применён в разделе `/admin/*`.
          `schedule`/`suggestions` из таблицы ТЗ сюда намеренно не входят —
          убраны из фронтенда (запрос 2026-09-28), backend не тронут; страницы
          `pages/lead/SchedulePage.tsx`/`SuggestionsPage.tsx` остаются в
          репозитории неподключёнными на случай, если понадобятся позже. */}
      <Route
        path="/lead"
        element={
          <RequireAuth>
            <RequireRole allowed={['Lead']}>
              <LeadLayout />
              <PreloadPages pages={LEAD_PAGES} />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={page(LeadDashboardPage)} />
        <Route path="assignments" element={page(LeadAssignmentsPage)} />
        <Route path="review-queue" element={page(LeadReviewQueuePage)} />
        <Route path="team" element={page(LeadTeamPage)} />
        <Route path="reports" element={page(LeadReportsPage)} />
        <Route path="profile" element={page(ProfilePage)} />
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
              <PreloadPages pages={MENTOR_PAGES} />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={page(MentorDashboardPage)} />
        <Route path="schedule" element={page(MentorSchedulePage)} />
        <Route path="tasks" element={page(MentorAssignmentsPage)} />
        <Route path="history" element={page(MentorHistoryPage)} />
        <Route path="reports" element={page(MentorReportsPage)} />
        <Route path="notifications" element={page(MentorNotificationsPage)} />
        <Route path="profile" element={page(ProfilePage)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
