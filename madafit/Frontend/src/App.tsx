import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Register from "./pages/Register";
import AccessControl from "./pages/AccessControl";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Products from "./pages/Products";
import Movements from "./pages/Movements";
import ReportsStock from "./pages/Reports_stock";
import History from "./pages/History";
import ApiTest from "./pages/ApiTest";
import Login from "./pages/Login";
import { NotificationProvider } from "@/contexts/NotificationContext";

// ← DÉPLACÉ en haut pour être accessible partout
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

    const handleSessionExpired = () => {
      setSession(null);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("madafit:sessionExpired", handleSessionExpired);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("madafit:sessionExpired", handleSessionExpired);
    };
  }, []);

  return {
    session,
    isAdmin: (session?.roles?.includes("ROLE_ADMIN") || session?.roles?.includes("ROLE_RECEPTIONIST")) ?? false,
    isReady,
  };
}

const App = () => {
  const { isAdmin, isReady } = useSession();

  // ← NOUVEAU : Écouter les demandes de refresh global
  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    window.addEventListener('madafit:refreshNotifications', handleRefresh);
    
    return () => {
      window.removeEventListener('madafit:refreshNotifications', handleRefresh);
    };
  }, []);

  if (!isReady) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={!isAdmin ? <Login /> : <Navigate to="/" replace />}
            />
            <Route
              path="/*"
              element={
                isAdmin ? (
                  <NotificationProvider>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/members" element={<Members />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/access" element={<AccessControl />} />
                        <Route path="/plans" element={<Plans />} />
                        <Route path="/subscriptions" element={<Subscriptions />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/movements" element={<Movements />} />
                        <Route path="/reports-stock" element={<ReportsStock />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/debug-api" element={<ApiTest />} />
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