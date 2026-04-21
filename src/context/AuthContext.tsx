"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI, setAccessToken, clearTokens } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const toast = useToast();

  // On mount: restore user from localStorage and try to refresh the access token
  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("accessToken");

      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        setAccessToken(savedToken);

        // Silently refresh the access token to validate the session
        try {
          const res = await authAPI.refresh();
          const { user: freshUser, accessToken: newToken } = res.data.data;
          setAccessToken(newToken);
          setUser(freshUser);
          localStorage.setItem("user", JSON.stringify(freshUser));
        } catch {
          // Refresh failed — session expired
          clearTokens();
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authAPI.login({ email, password });
      const { accessToken, user: newUser } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
      toast.success("Welcome back!", `Signed in as ${newUser.name}`);
      router.push("/");
    },
    [router, toast]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authAPI.register({ name, email, password });
      const { accessToken, user: newUser } = res.data.data;
      setAccessToken(accessToken);
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
      toast.success("Account created!", `Welcome, ${newUser.name}`);
      router.push("/");
    },
    [router, toast]
  );

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Continue logout even if API call fails
    }
    clearTokens();
    setUser(null);
    toast.info("Signed out", "You have been logged out successfully");
    router.push("/auth");
  }, [router, toast]);

  const logoutAll = useCallback(async () => {
    try {
      await authAPI.logoutAll();
    } catch {
      // Continue logout even if API call fails
    }
    clearTokens();
    setUser(null);
    router.push("/auth");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, logoutAll }}
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
