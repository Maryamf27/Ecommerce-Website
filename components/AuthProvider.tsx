"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth";

type AuthContextValue = {
  user: PublicUser | null;
  loaded: boolean;
  signingOut: boolean;
  error: string;
  logout: (redirectTo?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Loads the signed-in user once and shares it with the header, menus and pages. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      let response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
        if (refreshed.ok) response = await fetch("/api/auth/me", { cache: "no-store" });
      }
      const payload = await response.json() as { success?: boolean; data?: { user: PublicUser } };
      if (active) setUser(payload.success ? payload.data?.user ?? null : null);
    };
    loadUser()
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const logout = useCallback(async (redirectTo = "/") => {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      setUser(null);
      window.dispatchEvent(new Event("nexora:session-changed"));
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Sign-out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  const value = useMemo(() => ({ user, loaded, signingOut, error, logout }), [user, loaded, signingOut, error, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
