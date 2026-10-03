import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "@/api/services";
import { bootstrapCsrf, setSessionLostHandler } from "@/api/client";
import type { SessionUser } from "@/types";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Session is restored by asking the server, not by reading a token: the
     cookie is HttpOnly and deliberately invisible to this code (spec 46). */
  const loadSession = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    void bootstrapCsrf().then(loadSession);
  }, [loadSession]);

  const login = useCallback(async (username: string, password: string) => {
    await bootstrapCsrf();
    const session = await authApi.login(username, password);
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear locally even if the call failed: the user asked to leave.
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(user?.permissions ?? []);
    const isSuper = Boolean(user?.is_superuser);
    return {
      user,
      isLoading,
      login,
      logout,
      refresh: loadSession,
      can: (permission) => isSuper || permissions.has(permission),
      canAny: (...list) => isSuper || list.some((p) => permissions.has(p)),
      hasRole: (...roles) => (user?.roles ?? []).some((r) => roles.includes(r.code)),
    };
  }, [user, isLoading, login, logout, loadSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
