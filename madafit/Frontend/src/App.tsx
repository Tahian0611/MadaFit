import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard     from "./pages/Dashboard";
import Members       from "./pages/Members";
import Register      from "./pages/Register";
import AccessControl from "./pages/AccessControl";
import Plans         from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import Reports       from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings      from "./pages/Settings";
import NotFound      from "./pages/NotFound";
import Products      from "./pages/Products";
import Movements     from "./pages/Movements";
import ReportsStock  from "./pages/Reports_stock";
import History       from "./pages/History";
import Login         from "./pages/Login";
import Articles      from "./pages/Articles";
import PromoCodes     from "./pages/PromoCodes";
import { NotificationProvider } from "@/contexts/NotificationContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30000,
    },
  },
});

interface UserSession {
  email: string;
  roles: string[];
  firstName: string;
  [key: string]: any;
}

function useSession() {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const userStr = localStorage.getItem("madafit_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
    const handleStorage = () => {
      try {
        const userStr = localStorage.getItem("madafit_user");
        setSession(userStr ? JSON.parse(userStr) : null);
      } catch {
        setSession(null);
      }
    };
    const handleSessionExpired = () => setSession(null);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("madafit:sessionExpired", handleSessionExpired);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("madafit:sessionExpired", handleSessionExpired);
    };
  }, []);

  const isAdmin     = session?.roles?.includes("ROLE_ADMIN")     ?? false;
  const isReception = session?.roles?.includes("ROLE_RECEPTION") ?? false;
  const isStaff     = isAdmin || isReception;

  return { session, isAdmin, isReception, isStaff, isReady };
}

// ── Garde de route : admin uniquement ─────────────────────────────────────────
function AdminOnly({ children }: { children: React.ReactNode }) {
  const roles = (() => {
    try { return JSON.parse(localStorage.getItem("madafit_user") || "{}").roles || []; }
    catch { return []; }
  })();
  if (!roles.includes("ROLE_ADMIN")) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  const { isStaff, isReady } = useSession();

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    window.addEventListener("madafit:refreshNotifications", handleRefresh);
    return () => window.removeEventListener("madafit:refreshNotifications", handleRefresh);
  }, []);

  if (!isReady) return <div className="min-h-screen bg-background" />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Page login */}
            <Route
              path="/login"
              element={!isStaff ? <Login /> : <Navigate to="/" replace />}
            />

            {/* App protégée — staff uniquement (admin + accueil) */}
            <Route
              path="/*"
              element={
                isStaff ? (
                  <NotificationProvider>
                    <AppLayout>
                      <Routes>
                        {/* ── Routes communes admin + accueil ────────────── */}
                        <Route path="/"              element={<Dashboard />} />
                        <Route path="/members"       element={<Members />} />
                        <Route path="/register"      element={<Register />} />
                        <Route path="/access"        element={<AccessControl />} />
                        <Route path="/plans"         element={<Plans />} />
                        <Route path="/subscriptions" element={<Subscriptions />} />
                        <Route path="/products"     element={<Products />} />
                        <Route path="/movements"     element={<Movements />} />
                        <Route path="/reports-stock" element={<ReportsStock />} />
                        <Route path="/history"       element={<History />} />
                        <Route path="/articles"     element={<Articles />} />

                        {/* ── Notifications : admin + accueil ───────────── */}
                        <Route path="/notifications" element={<Notifications />} />

                        {/* ── Routes admin uniquement ────────────────────── */}
                        {/* /products déplacé dans les routes communes (admin + accueil) */}
                        <Route path="/reports"   element={<AdminOnly><Reports /></AdminOnly>} />
                        <Route path="/settings"  element={<AdminOnly><Settings /></AdminOnly>} />
                        {/* /articles déplacé dans les routes communes (admin + accueil) */}
                        <Route path="/promo-codes" element={<AdminOnly><PromoCodes /></AdminOnly>} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </NotificationProvider>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;