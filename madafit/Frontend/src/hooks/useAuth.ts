import { useMemo } from "react";

export interface AuthUser {
  id?: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  role: "admin" | "reception";
  memberId?: string;
  status?: string;
}

export function useAuth(): {
  user: AuthUser | null;
  isAdmin: boolean;
  isReception: boolean;
  isAuthenticated: boolean;
} {
  const user = useMemo((): AuthUser | null => {
    const raw = localStorage.getItem("madafit_user");
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const roles: string[] = parsed.roles || [];

      const role: "admin" | "reception" = roles.includes("ROLE_ADMIN")
        ? "admin"
        : "reception";

      const firstName = parsed.firstName || "";
      const lastName = parsed.lastName || "";

      return {
        id: parsed.id,
        email: parsed.email || parsed.username || "",
        firstName,
        lastName,
        fullName: firstName || lastName ? `${firstName} ${lastName}`.trim() : parsed.email || "",
        roles,
        role,
        memberId: parsed.memberId,
        status: parsed.status,
      };
    } catch {
      return null;
    }
  }, []);

  const isAdmin = user?.role === "admin" || false;
  const isReception = user?.role === "reception" || false;
  const isAuthenticated = !!user;

  return { user, isAdmin, isReception, isAuthenticated };
}