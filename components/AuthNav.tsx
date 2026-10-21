"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicUser } from "@/lib/auth";

type MeResponse = { success?: boolean; data?: { user: PublicUser } };

export default function AuthNav() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<MeResponse>)
      .then((payload) => { if (active) setUser(payload.success ? payload.data?.user ?? null : null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setPending(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      setUser(null);
      router.refresh();
    } catch {
      setLogoutError("Sign-out failed");
      setPending(false);
      return;
    }
    setPending(false);
  }

  if (!loaded) return <span className="auth-nav-placeholder" aria-hidden="true"/>;
  if (!user) return <nav className="auth-nav" aria-label="Account navigation"><Link href="/login">Sign in</Link><Link className="auth-register-link" href="/register">Join</Link></nav>;
  return <nav className="auth-nav" aria-label="Account navigation"><Link className="auth-account-link" href="/account">{user.name.split(/\s+/)[0]}</Link><button type="button" onClick={logout} disabled={pending}>{pending ? "Signing out" : "Sign out"}</button>{logoutError && <span className="auth-nav-error" role="alert">{logoutError}</span>}</nav>;
}
