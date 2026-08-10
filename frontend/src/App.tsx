import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/AuthPages";
import { NotFoundPage, ProfilePage, UnauthorizedPage } from "./pages/StatusPages";
import { LoadingState } from "./components/ui";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const TicketListPage = lazy(() => import("./pages/TicketListPage").then((module) => ({ default: module.TicketListPage })));
const CreateTicketPage = lazy(() => import("./pages/CreateTicketPage").then((module) => ({ default: module.CreateTicketPage })));
const TicketDetailPage = lazy(() => import("./pages/TicketDetailPage").then((module) => ({ default: module.TicketDetailPage })));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage").then((module) => ({ default: module.KnowledgeBasePage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage").then((module) => ({ default: module.UserManagementPage })));
const ManagementPage = lazy(() => import("./pages/ManagementPage").then((module) => ({ default: module.ManagementPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then((module) => ({ default: module.AuditPage })));

export default function App() {
  return <Suspense fallback={<LoadingState label="Seite wird geladen …" />}><Routes>
    <Route path="/anmelden" element={<LoginPage />} />
    <Route path="/registrieren" element={<RegisterPage />} />
    <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
    <Route path="/passwort-zuruecksetzen" element={<ResetPasswordPage />} />
    <Route path="/nicht-berechtigt" element={<UnauthorizedPage />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/tickets" element={<TicketListPage />} />
      <Route path="/tickets/neu" element={<CreateTicketPage />} />
      <Route path="/tickets/:id" element={<TicketDetailPage />} />
      <Route path="/wissen" element={<KnowledgeBasePage />} />
      <Route path="/benachrichtigungen" element={<NotificationsPage />} />
      <Route path="/profil" element={<ProfilePage />} />
      <Route path="/verwaltung/benutzer" element={<ProtectedRoute roles={["ADMIN"]}><UserManagementPage /></ProtectedRoute>} />
      <Route path="/verwaltung/teams" element={<ProtectedRoute roles={["ADMIN"]}><ManagementPage resource="teams" /></ProtectedRoute>} />
      <Route path="/verwaltung/kategorien" element={<ProtectedRoute roles={["ADMIN"]}><ManagementPage resource="categories" /></ProtectedRoute>} />
      <Route path="/verwaltung/tags" element={<ProtectedRoute roles={["ADMIN"]}><ManagementPage resource="tags" /></ProtectedRoute>} />
      <Route path="/verwaltung/sla" element={<ProtectedRoute roles={["ADMIN"]}><ManagementPage resource="sla-policies" /></ProtectedRoute>} />
      <Route path="/berichte" element={<ProtectedRoute roles={["ADMIN"]}><ReportsPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute roles={["ADMIN"]}><AuditPage /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense>;
}
