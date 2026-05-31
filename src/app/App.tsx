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

// Definition de toutes les routes de l'application avec leurs regles d'acces
const router = createBrowserRouter([
  {
    // Page de connexion accessible sans authentification
    path: "/login",
    Component: Login,
  },
  {
    // Toutes les routes enfants sont protegees : l'utilisateur doit etre connecte
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      // Tableau de bord : page d'accueil apres connexion, accessible a tous les roles
      { index: true, Component: Dashboard },
      {
        // Monitoring temps reel : reserve aux admins et techniciens
        path: "monitoring",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Monitoring />
          </RoleBasedRoute>
        ),
      },
      {
        // Analyse IA des donnees capteurs : reserve aux admins et techniciens
        path: "ai-analysis",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <AIAnalysis />
          </RoleBasedRoute>
        ),
      },
      {
        // Gestion des alertes capteurs : reserve aux admins et techniciens
        path: "alerts",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Alerts />
          </RoleBasedRoute>
        ),
      },
      {
        // Suivi des interventions de maintenance : reserve aux admins et techniciens
        path: "interventions",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <Interventions />
          </RoleBasedRoute>
        ),
      },
      {
        // Historique des mesures capteurs : reserve aux admins et techniciens
        path: "history",
        element: (
          <RoleBasedRoute allowedRoles={['admin', 'technicien']}>
            <History />
          </RoleBasedRoute>
        ),
      },
      // Parametres personnels : accessible a tous les utilisateurs connectes
      { path: "settings", Component: Settings },
      {
        // Tableau de bord admin : reserve aux administrateurs uniquement
        path: "admin",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <AdminPanel />
          </RoleBasedRoute>
        ),
      },
      {
        // Gestion des comptes utilisateurs : reserve aux administrateurs
        path: "admin/users",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <UserManagement />
          </RoleBasedRoute>
        ),
      },
      {
        // Gestion des panneaux solaires : reserve aux administrateurs
        path: "admin/panels",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <PanelManagement />
          </RoleBasedRoute>
        ),
      },
      {
        // Configuration systeme (seuils, intervalles) : reserve aux administrateurs
        path: "admin/settings",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <SystemSettings />
          </RoleBasedRoute>
        ),
      },
      {
        // Configuration materielle de l'ESP32 et des capteurs : reserve aux administrateurs
        path: "admin/hardware",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <HardwareConfig />
          </RoleBasedRoute>
        ),
      },
      {
        // Generation de rapports et export des donnees : reserve aux administrateurs
        path: "admin/reports",
        element: (
          <RoleBasedRoute allowedRoles={['admin']}>
            <Reports />
          </RoleBasedRoute>
        ),
      },
      // Page 404 : affichee pour toute route non reconnue
      { path: "*", Component: NotFound },
    ],
  },
]);

// Composant racine de l'application : fournit les contextes globaux a toute l'arborescence
function App() {
  return (
    // AuthProvider : gestion de l'authentification et des roles utilisateurs
    <AuthProvider>
      {/* PanelProvider : gestion des panneaux solaires et de leurs donnees */}
      <PanelProvider>
        {/* InterventionProvider : gestion des interventions de maintenance */}
        <InterventionProvider>
          <RouterProvider router={router} />
          {/* Toaster : systeme de notifications toast affiche globalement */}
          <Toaster />
        </InterventionProvider>
      </PanelProvider>
    </AuthProvider>
  );
}

export default App;
