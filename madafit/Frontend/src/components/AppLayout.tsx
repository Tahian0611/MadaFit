import { useState, useEffect } from "react";
import NotificationBell from '@/components/notifications/NotificationBell';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  History as HistoryIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Tag,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import logoImg from "@/assets/madafit-logo.png";
import api from "@/services/api";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/" },
  { icon: Users, label: "Membres", path: "/members" },
  { icon: UserPlus, label: "Inscription", path: "/register" },
  { icon: Wifi, label: "Controle d'acces", path: "/access" },
  { icon: Tag, label: "Offres", path: "/plans" },
  { icon: RefreshCw, label: "Abonnements", path: "/subscriptions" },
  { icon: ShoppingBag, label: "Produits", path: "/products" },
  { icon: ArrowRightLeft, label: "Mouvements", path: "/movements" },
  { icon: ClipboardList, label: "Stock", path: "/reports-stock" },
  { icon: BarChart3, label: "Rapports", path: "/reports" },
  { icon: HistoryIcon, label: "Historique", path: "/history" },
];

const bottomItems = [
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Settings, label: "Parametres", path: "/settings" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const { unreadCount } = useNotificationContext();

  const [sessionUser, setSessionUser] = useState<unknown | null>(() => {
    try { 
      return JSON.parse(localStorage.getItem("madafit_user") || "null"); 
    } catch { 
      return null; 
    }
  });

  useEffect(() => {
    const handler = () => {
      try { 
        setSessionUser(JSON.parse(localStorage.getItem("madafit_user") || "null")); 
      } catch { 
        setSessionUser(null); 
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const userInitial = sessionUser?.firstName?.charAt(0)?.toUpperCase() 
    || sessionUser?.email?.charAt(0)?.toUpperCase() 
    || "A";

  const userName = sessionUser?.firstName 
    ? `${sessionUser.firstName} ${sessionUser.lastName || ""}`.trim() 
    : "Admin MadaFit";

  const userEmail = sessionUser?.email || "admin@madafit.com";

  const userRole = sessionUser?.roles || "ROLE_ADMIN";

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      {/* Overlay Mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex h-full flex-col transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: collapsed ? "72px" : "260px",
          background: "var(--gradient-sidebar)",
          borderRight: "1px solid hsl(var(--sidebar-border))",
        }}
      >
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Header Sidebar */}
          <div className="flex items-center gap-3 px-4 py-5 border-b flex-shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
            <img src={logoImg} alt="MadaFit" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            {(!collapsed || mobileOpen) && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <p className="text-white font-bold text-lg leading-none tracking-tight whitespace-nowrap">MadaFit</p>
                <p className="text-xs mt-0.5 whitespace-nowrap" style={{ color: "hsl(var(--primary))" }}>
                  Salle de sport
                </p>
              </div>
            )}
          </div>

          {/* Badge Admin */}
          {(!collapsed || mobileOpen) && (
            <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "hsl(var(--primary) / 0.15)" }}>
                <Shield size={14} style={{ color: "hsl(var(--primary))" }} />
                <span className="text-xs font-semibold truncate" style={{ color: "hsl(var(--primary))" }}>
                  {userRole == "ROLE_ADMIN" ? "Administrateur" : "Receptioniste"}
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              if (userRole[0] != "ROLE_ADMIN" && item.label == "Rapports")
                return;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="nav-item group flex items-center h-10 px-3 rounded-lg transition-all"
                  style={{
                    background: isActive ? "hsl(var(--primary))" : undefined,
                    color: isActive ? "white" : undefined,
                    boxShadow: isActive ? "var(--shadow-red)" : undefined,
                  }}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {(!collapsed || mobileOpen) && (
                    <span className="ml-3 text-sm font-medium truncate animate-in slide-in-from-left-1">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Section Bas de Sidebar */}
          <div className="px-2 pb-4 space-y-1 border-t pt-3 flex-shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
            {bottomItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className="nav-item relative flex items-center h-10 px-3 rounded-lg"
                  style={{ background: isActive ? "hsl(var(--primary))" : undefined }}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {(!collapsed || mobileOpen) && (
                    <span className="ml-3 text-sm font-medium">{item.label}</span>
                  )}
                  {item.label === "Notifications" && unreadCount > 0 && (
                    <span
                      className="absolute flex items-center justify-center text-white font-bold rounded-full"
                      style={{
                        top: "8px",
                        right: collapsed && !mobileOpen ? "8px" : "12px",
                        width: "16px",
                        height: "16px",
                        background: "hsl(var(--primary))",
                        fontSize: "9px",
                        border: "2px solid var(--gradient-sidebar)"
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Profil Utilisateur */}
            <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-lg bg-white/5 overflow-hidden">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold border border-white/10">
                {userInitial}
              </div>
              {(!collapsed || mobileOpen) && (
                <div className="flex-1 min-w-0 animate-in fade-in">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-[10px] truncate opacity-50 text-white">{userEmail}</p>
                </div>
              )}
              {(!collapsed || mobileOpen) && (
                <button 
                  onClick={() => api.auth.logout()}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Bouton de réduction (Desktop uniquement) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex absolute -right-3 top-20 z-10 items-center justify-center w-6 h-6 rounded-full border text-white transition-transform hover:scale-110 shadow-lg"
            style={{
              background: "hsl(var(--sidebar-bg))",
              borderColor: "hsl(var(--sidebar-border))",
            }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </aside>

      {/* Contenu Principal */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <header 
          className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 h-16 border-b bg-card/80 backdrop-blur-md z-30" 
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" 
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2.5">
              <Dumbbell size={20} className="text-primary" />
              <span className="text-sm font-semibold text-muted-foreground hidden md:block">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-accent/5 border-accent/20">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-bold text-accent uppercase tracking-tight hidden xs:block">Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background/50">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}