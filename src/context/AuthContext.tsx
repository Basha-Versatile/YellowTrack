"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI, permissionsAPI, setAccessToken, clearTokens } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  mustResetPassword?: boolean;
}

function postLoginRoute(user: User): string {
  if (user.mustResetPassword) return "/reset-password";
  if (user.role === "SUPERADMIN") return "/superadmin";
  return "/";
}

interface AuthContextType {
  user: User | null;
  permissions: Set<string>;
  hasPermission: (perm: string) => boolean;
  isLoading: boolean;
  permissionsLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const res = await permissionsAPI.get();
      const mine = (res.data.data.mine as string[]) ?? [];
      setPermissions(new Set(mine));
    } catch {
      setPermissions(new Set());
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const hasPermission = useCallback(
    (perm: string) => permissions.has(perm),
    [permissions],
  );

  // On mount: restore user from localStorage and try to refresh the access token
  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("accessToken");

      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        setAccessToken(savedToken);

        try {
          const res = await authAPI.refresh();
          const { user: freshUser, accessToken: newToken } = res.data.data;
          setAccessToken(newToken);
          setUser(freshUser);
          localStorage.setItem("user", JSON.stringify(freshUser));
          if (freshUser.role !== "SUPERADMIN") {
            await loadPermissions();
          }
        } catch {
          clearTokens();
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, [loadPermissions]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authAPI.login({ email, password });
      const { accessToken, user: newUser } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
      if (newUser.role !== "SUPERADMIN") {
        await loadPermissions();
      }
      toast.success("Welcome back!", `Signed in as ${newUser.name}`);
      router.push(postLoginRoute(newUser));
    },
    [router, toast, loadPermissions]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authAPI.register({ name, email, password });
      const { accessToken, user: newUser } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
      if (newUser.role !== "SUPERADMIN") {
        await loadPermissions();
      }
      toast.success("Account created!", `Welcome, ${newUser.name}`);
      router.push(postLoginRoute(newUser));
    },
    [router, toast, loadPermissions]
  );

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    setPermissions(new Set());
    toast.info("Signed out", "You have been logged out successfully");
    router.push("/auth");
  }, [router, toast]);

  const logoutAll = useCallback(async () => {
    try {
      await authAPI.logoutAll();
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    setPermissions(new Set());
    router.push("/auth");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        hasPermission,
        isLoading,
        permissionsLoading,
        login,
        register,
        logout,
        logoutAll,
        refreshPermissions: loadPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
