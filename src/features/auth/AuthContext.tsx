import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/api/services";
import { allowSessionRequests, blockSessionRefresh, bootstrapCsrf, setSessionLostHandler } from "@/api/client";
import type { SessionUser } from "@/types";
import { SessionTimeout } from "./SessionTimeout";

// This is only a signed-out flag, never a token or user profile. It prevents
// stale cookies restoring a session after an offline logout and page reload.
const SIGNED_OUT = "zbt.session.signed-out";
function isSignedOut() {
  try { return localStorage.getItem(SIGNED_OUT) === "1"; } catch { return false; }
}

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
  const queryClient = useQueryClient();
  const generation = useRef(0);
  const logoutInFlight = useRef<Promise<void> | null>(null);

  const finishServerSignOut = useCallback(() => {
    logoutInFlight.current ??= authApi.logout().then(() => undefined).finally(() => {
      logoutInFlight.current = null;
    });
    return logoutInFlight.current;
  }, []);

  const clearSession = useCallback(() => {
    generation.current += 1;
    blockSessionRefresh();
    try { localStorage.setItem(SIGNED_OUT, "1"); } catch { /* Storage may be disabled. */ }
    setUser(null);
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  /* Session is restored by asking the server, not by reading a token: the
     cookie is HttpOnly and deliberately invisible to this code (spec 46). */
  const loadSession = useCallback(async () => {
    const attempt = generation.current;
    if (isSignedOut()) {
      setIsLoading(false);
      return;
    }
    try {
      const session = await authApi.me();
      if (attempt === generation.current && !isSignedOut()) setUser(session);
    } catch {
      if (attempt === generation.current) setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedOut()) blockSessionRefresh();
    else allowSessionRequests();
    setSessionLostHandler(clearSession);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNED_OUT && event.newValue === "1") clearSession();
    };
    const retrySignOut = () => {
      if (isSignedOut()) void finishServerSignOut().catch(() => { /* Retry on reconnect. */ });
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", retrySignOut);
    void bootstrapCsrf().then(() => { retrySignOut(); return loadSession(); });
    return () => {
      setSessionLostHandler(null);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", retrySignOut);
    };
  }, [loadSession, clearSession, finishServerSignOut]);

  const login = useCallback(async (username: string, password: string) => {
    // A delayed logout response must finish before it can erase a new login's cookies.
    await logoutInFlight.current?.catch(() => undefined);
    const attempt = generation.current;
    await bootstrapCsrf();
    const session = await authApi.login(username, password);
    if (attempt !== generation.current) throw new Error("Sign-in was cancelled. Please try again.");
    generation.current += 1;
    try { localStorage.removeItem(SIGNED_OUT); } catch { /* Storage may be disabled. */ }
    allowSessionRequests();
    queryClient.clear();
    setUser(session);
    return session;
  }, [queryClient]);

  const logout = useCallback(async () => {
    clearSession(); // Redirect/unmount immediately, not after the HTTP timeout.
    void finishServerSignOut().catch(() => {
      toast.warning("Signed out on this browser. Server sign-out could not be confirmed; reconnect to finish it.");
    });
  }, [clearSession, finishServerSignOut]);

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

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user?.session && <SessionTimeout user={user} logout={logout} />}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
