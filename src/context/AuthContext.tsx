"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  authAPI,
  permissionsAPI,
  setAccessToken,
  setAuthPersistent,
  clearTokens,
  tenantAPI,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  mustResetPassword?: boolean;
  profileImage?: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  billingEmail: string | null;
}

function postLoginRoute(user: User): string {
  if (user.mustResetPassword) return "/reset-password";
  if (user.role === "SUPERADMIN") return "/superadmin";
  return "/dashboard";
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  permissions: Set<string>;
  hasPermission: (perm: string) => boolean;
  isLoading: boolean;
  permissionsLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    profileImage?: File | null;
    removeProfileImage?: boolean;
  }) => Promise<void>;
  updateTenant: (data: {
    name?: string;
    billingEmail?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
    logo?: File | null;
    removeLogo?: boolean;
  }) => Promise<Tenant>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mirrors the storage resolver in lib/api.ts. When "Remember Me" was off at
// login time, auth data lives in sessionStorage (cleared on tab close);
// otherwise it lives in localStorage.
function authStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth:persistent") === "false"
    ? sessionStorage
    : localStorage;
}

function readAuthItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  // Fall back to the other store on miss so we don't lose session-mode
  // sign-ins when the persistence flag hasn't been read yet on first render.
  return (
    authStore()?.getItem(key) ??
    sessionStorage.getItem(key) ??
    localStorage.getItem(key)
  );
}

function writeAuthItem(key: string, value: string) {
  const store = authStore();
  if (!store) return;
  store.setItem(key, value);
  // Make sure the *other* store doesn't keep a stale copy.
  (store === localStorage ? sessionStorage : localStorage).removeItem(key);
}

function removeAuthItem(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
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

  // On mount: restore user + tenant from the persistence-aware store and try
  // to refresh the access token.
  useEffect(() => {
    const init = async () => {
      const savedUser = readAuthItem("user");
      const savedTenant = readAuthItem("tenant");
      const savedToken = readAuthItem("accessToken");

      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        if (savedTenant) {
          try { setTenant(JSON.parse(savedTenant)); } catch { /* ignore corrupt cache */ }
        }
        setAccessToken(savedToken);

        try {
          const res = await authAPI.refresh();
          const {
            user: freshUser,
            tenant: freshTenant,
            accessToken: newToken,
            persistent,
          } = res.data.data;
          // Refresh response tells us the server's view of the persistence
          // mode, so the client store always matches the cookie lifetime.
          if (typeof persistent === "boolean") setAuthPersistent(persistent);
          setAccessToken(newToken);
          setUser(freshUser);
          setTenant(freshTenant ?? null);
          writeAuthItem("user", JSON.stringify(freshUser));
          if (freshTenant) {
            writeAuthItem("tenant", JSON.stringify(freshTenant));
          } else {
            removeAuthItem("tenant");
          }
          if (freshUser.role !== "SUPERADMIN") {
            await loadPermissions();
          }
        } catch {
          clearTokens();
          setUser(null);
          setTenant(null);
          removeAuthItem("tenant");
        }
      }

      setIsLoading(false);
    };

    init();
  }, [loadPermissions]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      // Apply the persistence choice BEFORE any storage writes so the helpers
      // route accessToken/user/tenant to the correct store from the start.
      setAuthPersistent(rememberMe);
      const res = await authAPI.login({ email, password, rememberMe });
      const { accessToken, user: newUser, tenant: newTenant } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      setTenant(newTenant ?? null);
      writeAuthItem("user", JSON.stringify(newUser));
      if (newTenant) {
        writeAuthItem("tenant", JSON.stringify(newTenant));
      } else {
        removeAuthItem("tenant");
      }
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
      // Brand-new accounts default to a persistent session.
      setAuthPersistent(true);
      const res = await authAPI.register({ name, email, password });
      const { accessToken, user: newUser, tenant: newTenant } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      setTenant(newTenant ?? null);
      writeAuthItem("user", JSON.stringify(newUser));
      if (newTenant) {
        writeAuthItem("tenant", JSON.stringify(newTenant));
      } else {
        removeAuthItem("tenant");
      }
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
    setTenant(null);
    setPermissions(new Set());
    removeAuthItem("tenant");
    toast.info("Signed out", "You have been logged out successfully");
    router.push("/");
  }, [router, toast]);

  const logoutAll = useCallback(async () => {
    try {
      await authAPI.logoutAll();
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    setTenant(null);
    setPermissions(new Set());
    removeAuthItem("tenant");
    router.push("/");
  }, [router]);

  const updateProfile = useCallback(
    async (data: {
      name?: string;
      profileImage?: File | null;
      removeProfileImage?: boolean;
    }) => {
      const res = await authAPI.updateProfile(data);
      const fresh = (res.data.data as { user: User }).user;
      setUser(fresh);
      writeAuthItem("user", JSON.stringify(fresh));
    },
    [],
  );

  const updateTenant = useCallback(
    async (data: {
      name?: string;
      billingEmail?: string | null;
      gstNumber?: string | null;
      panNumber?: string | null;
      addressLine?: string | null;
      city?: string | null;
      state?: string | null;
      pinCode?: string | null;
      logo?: File | null;
      removeLogo?: boolean;
    }): Promise<Tenant> => {
      const res = await tenantAPI.updateMine(data);
      const fresh = res.data.data as {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        billingEmail: string | null;
      };
      // Sidebar / header read these four fields from the AuthContext tenant
      // cache. Keep the cached slim view in sync so logo + name updates show
      // up instantly without a page reload.
      const slim: Tenant = {
        id: fresh.id,
        name: fresh.name,
        slug: fresh.slug,
        logoUrl: fresh.logoUrl ?? null,
        billingEmail: fresh.billingEmail ?? null,
      };
      setTenant(slim);
      writeAuthItem("tenant", JSON.stringify(slim));
      return slim;
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        permissions,
        hasPermission,
        isLoading,
        permissionsLoading,
        login,
        register,
        logout,
        logoutAll,
        refreshPermissions: loadPermissions,
        updateProfile,
        updateTenant,
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
