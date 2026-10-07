import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { Spinner } from "@/components/ui/primitives";
import { MASTER_CONFIGS } from "@/features/masters/configs";
import { REPORT_CONFIGS } from "@/features/reports/configs";
import { NotFoundPage } from "@/features/misc/NotFoundPage";

/* Route surfaces load only when visited, including the public and auth flows. */
const AppLayout = lazy(() => import("@/layouts/AppLayout").then((m) => ({ default: m.AppLayout })));
const LoginPage = lazy(() => import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const TrackTicketPage = lazy(() => import("@/features/public/TrackTicketPage").then((m) => ({ default: m.TrackTicketPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ChatPage = lazy(() => import("@/features/chat/ChatPage").then((m) => ({ default: m.ChatPage })));
const DailyUpdatesPage = lazy(() => import("@/features/daily-updates/DailyUpdatesPage").then((m) => ({ default: m.DailyUpdatesPage })));
const BugListPage = lazy(() => import("@/features/bugs/BugListPage").then((m) => ({ default: m.BugListPage })));
const BugDetailPage = lazy(() => import("@/features/bugs/BugDetailPage").then((m) => ({ default: m.BugDetailPage })));
const BugFormPage = lazy(() => import("@/features/bugs/BugFormPage").then((m) => ({ default: m.BugFormPage })));
const TicketListPage = lazy(() => import("@/features/tickets/TicketListPage").then((m) => ({ default: m.TicketListPage })));
function TicketDetailRedirect() {
  const { ticketId = "" } = useParams();
  return <Navigate to={`/tickets?ticket=${encodeURIComponent(ticketId)}`} replace />;
}
const CreateTicketPage = lazy(() => import("@/features/tickets/CreateTicketPage").then((m) => ({ default: m.CreateTicketPage })));
const ReassignTicketsPage = lazy(() => import("@/features/tickets/ReassignTicketsPage").then((m) => ({ default: m.ReassignTicketsPage })));
const MasterShell = lazy(() => import("@/features/masters/MasterShell").then((m) => ({ default: m.MasterShell })));
const ReportShell = lazy(() => import("@/features/reports/ReportShell").then((m) => ({ default: m.ReportShell })));
const TeamWorkloadPage = lazy(() => import("@/features/team/TeamPages").then((m) => ({ default: m.TeamWorkloadPage })));
const AssignmentBoardPage = lazy(() => import("@/features/team/TeamPages").then((m) => ({ default: m.AssignmentBoardPage })));
const ProfilePage = lazy(() => import("@/features/misc/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const AuditLogPage = lazy(() => import("@/features/administration/AuditLogPage").then((m) => ({ default: m.AuditLogPage })));
const UserManagementPage = lazy(() => import("@/features/administration/UserManagementPage").then((m) => ({ default: m.UserManagementPage })));
const RoleManagementPage = lazy(() => import("@/features/administration/RoleManagementPage").then((m) => ({ default: m.RoleManagementPage })));
const PermissionMatrixPage = lazy(() => import("@/features/administration/PermissionMatrixPage").then((m) => ({ default: m.PermissionMatrixPage })));

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="size-6 text-[var(--muted-foreground)]" />
    </div>
  );
}

function MasterRoute() {
  const { resource = "" } = useParams();
  const config = MASTER_CONFIGS[resource];
  if (!config) return <NotFoundPage />;
  return <MasterShell config={config} />;
}

function ReportRoute() {
  const { name = "" } = useParams();
  const config = REPORT_CONFIGS[name];
  if (!config) return <NotFoundPage />;
  return <ReportShell config={config} />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Public: reached from the link in a requester's assignment email, so
            it must sit outside the auth guard and the app shell. */}
        <Route path="/track" element={<TrackTicketPage />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chat" element={
            <ProtectedRoute permissions={["tickets.ticket.view"]}><ChatPage /></ProtectedRoute>
          } />
          {/* ---- LEGACY BUG ROUTES: compatibility redirects into unified tickets ---- */}
          <Route path="/bugs" element={<Navigate to="/tickets/bugs" replace />} />
          <Route path="/bugs/new" element={<Navigate to="/tickets/new" replace />} />
          <Route path="/bugs/detail/:bugId" element={<BugDetailPage />} />
          <Route path="/bugs/mine" element={<Navigate to="/tickets" replace />} />
          <Route path="/bugs/assigned" element={<Navigate to="/tickets" replace />} />
          <Route path="/bugs/unassigned" element={<Navigate to="/tickets/unassigned" replace />} />
          <Route path="/bugs/critical" element={<Navigate to="/tickets/critical" replace />} />
          <Route path="/bugs/overdue" element={<Navigate to="/tickets/overdue" replace />} />
          <Route path="/bugs/testing" element={<Navigate to="/tickets/testing" replace />} />
          <Route path="/bugs/reopened" element={<Navigate to="/tickets/bugs?status=REOPENED" replace />} />
          <Route path="/bugs/closed" element={<Navigate to="/tickets/closed" replace />} />

          {/* ---- TICKETS: unified domain with preset-filtered list routes ---- */}
          <Route path="/tickets/new" element={
            <ProtectedRoute permissions={["tickets.create.access"]}><CreateTicketPage /></ProtectedRoute>
          } />
          <Route path="/tickets/unassigned" element={
            <ProtectedRoute permissions={["tickets.unassigned.access"]}><TicketListPage presetKey="unassigned" /></ProtectedRoute>
          } />
          <Route path="/tickets/reassign" element={
            <ProtectedRoute permissions={["tickets.reassign.access"]}><ReassignTicketsPage /></ProtectedRoute>
          } />
          <Route path="/tickets" element={
            <ProtectedRoute permissions={["tickets.all.access"]}><TicketListPage presetKey="all" /></ProtectedRoute>
          } />
          <Route path="/tickets/review" element={<Navigate to="/tickets/unassigned" replace />} />
          <Route path="/tickets/bugs" element={
            <ProtectedRoute permissions={["tickets.bugs.access"]}><TicketListPage presetKey="bugs" /></ProtectedRoute>
          } />
          <Route path="/tickets/service" element={<Navigate to="/tickets/services" replace />} />
          <Route path="/tickets/services" element={
            <ProtectedRoute permissions={["tickets.services.access"]}><TicketListPage presetKey="services" /></ProtectedRoute>
          } />
          <Route path="/tickets/access" element={
            <ProtectedRoute permissions={["tickets.access.access"]}><TicketListPage presetKey="access" /></ProtectedRoute>
          } />
          <Route path="/tickets/critical" element={
            <ProtectedRoute permissions={["tickets.critical.access"]}><TicketListPage presetKey="critical" /></ProtectedRoute>
          } />
          <Route path="/tickets/overdue" element={
            <ProtectedRoute permissions={["tickets.overdue.access"]}><TicketListPage presetKey="overdue" /></ProtectedRoute>
          } />
          <Route path="/tickets/testing" element={
            <ProtectedRoute permissions={["tickets.testing.access"]}><TicketListPage presetKey="testing" /></ProtectedRoute>
          } />
          <Route path="/tickets/closed" element={
            <ProtectedRoute permissions={["tickets.closed.access"]}><TicketListPage presetKey="closed" /></ProtectedRoute>
          } />
          {/* The detail page is now a dialog on the list. The id is carried
              across as ?ticket= so an old link still opens the right ticket
              rather than dumping the reader on an unfiltered list. */}
          <Route path="/tickets/detail/:ticketId" element={<TicketDetailRedirect />} />

          {/* ---- DAILY UPDATES: also views of the same domain ---- */}
          <Route path="/updates/pending" element={<BugListPage presetKey="update-pending" />} />
          <Route path="/updates/today" element={
            <ProtectedRoute permissions={["bugs.update.view"]}>
              <ProtectedRoute permissions={["tickets.ticket.view"]}><DailyUpdatesPage /></ProtectedRoute>
            </ProtectedRoute>
          } />
          <Route path="/updates/mine" element={<BugListPage presetKey="assigned" />} />
          <Route path="/updates/team" element={<BugListPage presetKey="all" />} />

          {/* ---- TEAM ---- */}
          <Route path="/team/workload" element={
            <ProtectedRoute permissions={["teams.workload.view"]}><TeamWorkloadPage /></ProtectedRoute>
          } />
          <Route path="/team/overview" element={
            <ProtectedRoute permissions={["teams.workload.view"]}><TeamWorkloadPage /></ProtectedRoute>
          } />
          <Route path="/team/assignment" element={
            <ProtectedRoute permissions={["teams.assignment.use"]}><AssignmentBoardPage /></ProtectedRoute>
          } />

          {/* ---- REPORTS: one shell, nine configs ---- */}
          <Route path="/reports/:name" element={
            <ProtectedRoute permissions={["reports.report.view"]}><ReportRoute /></ProtectedRoute>
          } />

          {/* ---- MASTERS: one shell, nine configs ---- */}
          <Route path="/masters/:resource" element={
            <ProtectedRoute permissions={["masters.master.view"]}><MasterRoute /></ProtectedRoute>
          } />

          {/* ---- ADMINISTRATION ----
              Every entry under the Administration group in navigation.ts must
              have a route here, or the sidebar links into a 404. */}
          <Route path="/admin/users" element={
            <ProtectedRoute permissions={["admin.user.view"]}><UserManagementPage /></ProtectedRoute>
          } />
          <Route path="/admin/roles" element={
            <ProtectedRoute permissions={["admin.role.view"]}><RoleManagementPage /></ProtectedRoute>
          } />
          <Route path="/admin/permissions" element={
            <ProtectedRoute permissions={["admin.permission.view"]}><PermissionMatrixPage /></ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute permissions={["admin.audit.view"]}><AuditLogPage /></ProtectedRoute>
          } />

          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
