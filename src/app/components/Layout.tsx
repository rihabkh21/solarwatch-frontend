import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation, useNavigate, Outlet } from 'react-router';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import {
  LayoutDashboard,
  Activity,
  History,
  Settings,
  LogOut,
  Menu,
  Bell,
  User,
  CircuitBoard,
  Sun,
  Shield,
  Users,
  BarChart3,
  Cpu,
  Wrench,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInterventions } from '../contexts/InterventionContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavContentProps {
  user: { name: string; email: string; role: string } | null;
  navigation: NavItem[];
  adminNav: NavItem[];
  currentTime: Date;
  currentPath: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  onCloseMobile: () => void;
  roleBadge: React.ReactNode;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const baseNavigation: NavItem[] = [
  { name: 'Dashboard',     href: '/',             icon: LayoutDashboard, roles: ['admin', 'technicien', 'user'] },
  { name: 'Surveillance',  href: '/monitoring',   icon: Activity,        roles: ['admin', 'technicien'] },
  { name: 'IA',            href: '/ai-analysis',  icon: CircuitBoard,    roles: ['admin', 'technicien'] },
  { name: 'Alertes',       href: '/alerts',       icon: Bell,            roles: ['admin', 'technicien'] },
  { name: 'Interventions', href: '/interventions', icon: Wrench,         roles: ['admin', 'technicien'] },
  { name: 'Historique',    href: '/history',      icon: History,         roles: ['admin', 'technicien'] },
  { name: 'Paramètres',    href: '/settings',     icon: Settings,        roles: ['admin', 'technicien', 'user'] },
];

const adminNavigation: NavItem[] = [
  { name: 'Admin',    href: '/admin',          icon: Shield,    roles: ['admin'] },
  { name: 'Users',    href: '/admin/users',    icon: Users,     roles: ['admin'] },
  { name: 'Panneaux', href: '/admin/panels',   icon: LayoutGrid,roles: ['admin'] },
  { name: 'Config',   href: '/admin/settings', icon: Settings,  roles: ['admin'] },
  { name: 'Hardware', href: '/admin/hardware', icon: Cpu,       roles: ['admin'] },
  { name: 'Rapports', href: '/admin/reports',  icon: BarChart3, roles: ['admin'] },
];

// ─── Bottom nav items (mobile) — les 5 plus importants ───────────────────────

const bottomNavItems = [
  { name: 'Dashboard', href: '/',             icon: LayoutDashboard, roles: ['admin', 'technicien', 'user'] },
  { name: 'Alertes',   href: '/alerts',       icon: Bell,            roles: ['admin', 'technicien'] },
  { name: 'IA',        href: '/ai-analysis',  icon: CircuitBoard,    roles: ['admin', 'technicien'] },
  { name: 'Historique',href: '/history',      icon: History,         roles: ['admin', 'technicien'] },
  { name: 'Paramètres',href: '/settings',     icon: Settings,        roles: ['admin', 'technicien', 'user'] },
];

// ─── NavContent ───────────────────────────────────────────────────────────────

function NavContent({
  user,
  navigation,
  adminNav,
  currentTime,
  currentPath,
  onNavigate,
  onLogout,
  onCloseMobile,
  roleBadge,
}: NavContentProps) {
  const { unreadCount } = useInterventions();
  const pendingCount = user ? unreadCount(user.email) : 0;

  const handleAdminClick = (e: React.MouseEvent) => {
    if (!user || user.role !== 'admin') {
      e.preventDefault();
      e.stopPropagation();
      toast.error('Accès refusé');
      onNavigate('/');
      return;
    }
    onCloseMobile();
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
          <Sun className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">SolarWatch</h1>
          <p className="text-xs text-gray-500">Surveillance Solaire</p>
        </div>
      </div>

      {/* Navigation scrollable */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0">
        {/* Admin Section */}
        {user?.role === 'admin' && adminNav.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Administration</p>
            {adminNav.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleAdminClick}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 transition-colors ${
                    isActive
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
            <div className="h-4" />
            <p className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Navigation</p>
          </>
        )}

        {/* Main Navigation */}
        {navigation.map((item) => {
          const isActive = currentPath === item.href;
          const isInterventions = item.href === '/interventions';
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 transition-colors ${
                isActive
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium flex-1">{item.name}</span>
              {isInterventions && pendingCount > 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                }`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t p-4 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              {roleBadge}
            </div>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 mb-3"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>

        <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-3">
          <p className="text-sm font-medium text-gray-900">Système IoT Connecté</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700">En ligne</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Bottom Navigation Bar (mobile only) ─────────────────────────────────────

function BottomNav({
  user,
  currentPath,
}: {
  user: { role: string } | null;
  currentPath: string;
}) {
  const { unreadCount } = useInterventions();
  const pendingCount = user ? unreadCount((user as any).email) : 0;

  const items = bottomNavItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          const isAlerts = item.href === '/alerts';
          return (
            <Link
              key={item.href}
              to={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 relative"
            >
              <div className={`relative flex items-center justify-center rounded-xl px-3 py-1 transition-all ${
                isActive ? 'bg-amber-500' : ''
              }`}>
                <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {isAlerts && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const adminPaths = ['/admin', '/admin/users', '/admin/settings', '/admin/reports', '/admin/hardware'];
    const isAdminRoute = adminPaths.some((p) => location.pathname.startsWith(p));
    if (isAdminRoute && user.role !== 'admin') {
      toast.error("Accès refusé : vous n'avez pas les permissions nécessaires");
      navigate('/', { replace: true });
    }
  }, [location.pathname, user, navigate]);

  const handleLogout = () => {
    logout();
    toast.success('Déconnexion réussie');
    navigate('/login');
  };

  const navigation = baseNavigation.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const adminNav = user?.role === 'admin' ? adminNavigation : [];

  const roleBadge = (() => {
    if (!user) return null;
    const map: Record<string, { text: string; cls: string }> = {
      admin:      { text: 'Admin',       cls: 'bg-purple-100 text-purple-700 border-purple-200' },
      technicien: { text: 'Technicien',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      user:       { text: 'Utilisateur', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    };
    const b = map[user.role];
    return b ? (
      <Badge variant="outline" className={`text-xs ${b.cls}`}>
        {b.text}
      </Badge>
    ) : null;
  })();

  const navProps: NavContentProps = {
    user,
    navigation,
    adminNav,
    currentTime,
    currentPath: location.pathname,
    onNavigate: navigate,
    onLogout: handleLogout,
    onCloseMobile: () => setMobileMenuOpen(false),
    roleBadge,
  };

  return (
    <div className="flex h-screen bg-gray-50">

      {/* ── Sidebar Desktop ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-white border-r">
        <NavContent {...navProps} />
      </aside>

      {/* ── Sidebar Mobile (Sheet) — pour accès complet via hamburger ── */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 flex flex-col overflow-hidden">
          <NavContent {...navProps} />
        </SheetContent>
      </Sheet>

      {/* ── Contenu principal ── */}
      {/* pb-16 sur mobile pour ne pas être caché par la bottom nav */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Navigation Bar (mobile uniquement) ── */}
      <BottomNav user={user} currentPath={location.pathname} />
    </div>
  );
}
