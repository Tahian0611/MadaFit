import { useMemo } from "react";

export type UserRole = "admin" | "reception" | "member";

export interface AuthUser {
  id?: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  role: UserRole;
  memberId?: string;
  status?: string;
}

export function useAuth(): {
  user: AuthUser | null;
  isAdmin: boolean;
  isReception: boolean;
  isStaff: boolean;
  isAuthenticated: boolean;
} {
  const user = useMemo((): AuthUser | null => {
    const raw = localStorage.getItem("madafit_user");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const roles: string[] = parsed.roles || [];

      let role: UserRole = "member";
      if (roles.includes("ROLE_ADMIN")) {
        role = "admin";
      } else if (roles.includes("ROLE_RECEPTION")) {
        role = "reception";
      }

      const firstName = parsed.firstName || "";
      const lastName  = parsed.lastName  || "";

      return {
        id:       parsed.id,
        email:    parsed.email || parsed.username || "",
        firstName,
        lastName,
        fullName: (firstName || lastName)
          ? `${firstName} ${lastName}`.trim()
          : parsed.email || "",
        roles,
        role,
        memberId: parsed.memberId,
        status:   parsed.status,
      };
    } catch {
      return null;
    }
  }, []);

  return {
    user,
    isAdmin:       user?.role === "admin"     || false,
    isReception:   user?.role === "reception" || false,
    isStaff:       user?.role === "admin" || user?.role === "reception" || false,
    isAuthenticated: !!user,
  };
}