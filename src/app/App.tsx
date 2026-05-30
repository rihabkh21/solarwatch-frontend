import { RouterProvider } from 'react-router';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { InterventionProvider } from './contexts/InterventionContext';
import { PanelProvider } from './contexts/PanelContext';
import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { Monitoring } from "./pages/Monitoring";
import { AIAnalysis } from "./pages/AIAnalysis";
import { Alerts } from "./pages/Alerts";
import { History } from "./pages/History";
import { Interventions } from "./pages/Interventions";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { AdminPanel } from "./pages/admin/AdminPanel";
import { UserManagement } from "./pages/admin/UserManagement";
import { SystemSettings } from "./pages/admin/SystemSettings";
import { HardwareConfig } from "./pages/admin/HardwareConfig";
import { Reports } from "./pages/admin/Reports";
import { PanelManagement } from "./pages/admin/PanelManagement";
import { NotFound } from "./pages/NotFound";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleBasedRoute } from "./components/RoleBasedRoute";

const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      {
        path: "monitoring",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Monitoring />
          </RoleBasedRoute>
        ),
      },
      {
        path: "ai-analysis",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <AIAnalysis />
          </RoleBasedRoute>
        ),
      },
      {
        path: "alerts",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Alerts />
          </RoleBasedRoute>
        ),
      },
      {
        path: "interventions",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Interventions />
          </RoleBasedRoute>
        ),
      },
      {
        path: "history",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <History />
          </RoleBasedRoute>
        ),
      },
      { path: "settings", Component: Settings },
      {
        path: "admin",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <AdminPanel />
          </RoleBasedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <UserManagement />
          </RoleBasedRoute>
        ),
      },
      {
        path: "admin/panels",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <PanelManagement />
          </RoleBasedRoute>
        ),
      },
      {
        path: "admin/settings",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <SystemSettings />
          </RoleBasedRoute>
        ),
      },
      {
        path: "admin/hardware",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <HardwareConfig />
          </RoleBasedRoute>
        ),
      },
      {
        path: "admin/reports",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <Reports />
          </RoleBasedRoute>
        ),
      },
      { path: "*", Component: NotFound },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <PanelProvider>
        <InterventionProvider>
          <RouterProvider router={router} />
          <Toaster />
        </InterventionProvider>
      </PanelProvider>
    </AuthProvider>
  );
}

export default App;

