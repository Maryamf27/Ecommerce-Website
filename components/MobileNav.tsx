"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth";

type MeResponse = { success?: boolean; data?: { user: PublicUser } };

export default function MobileNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<MeResponse>)
      .then((payload) => { if (active) setUser(payload.success ? payload.data?.user ?? null : null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      setUser(null);
      window.dispatchEvent(new Event("nexora:session-changed"));
      setOpen(false);
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError("Sign-out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        className="mobile-menu-toggle icon-button"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
      </button>

      {open && (
        <div className="mobile-nav-overlay" onClick={() => setOpen(false)}>
          <nav
            className="mobile-nav"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
            <Link href="/shop" onClick={() => setOpen(false)}>Shop</Link>
            <Link href="/shop#categories" onClick={() => setOpen(false)}>Categories</Link>
            <span className="mobile-nav-divider"/>
            {user ? <><Link href="/account" onClick={() => setOpen(false)}>My account</Link><button className="mobile-signout" type="button" disabled={signingOut} onClick={logout}>{signingOut ? "Signing out…" : "Sign out"}</button>{logoutError && <p className="auth-nav-error mobile-logout-error" role="alert">{logoutError}</p>}</> : <><Link href="/login" onClick={() => setOpen(false)}>Sign in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}
          </nav>
        </div>
      )}
    </>
  );
}
