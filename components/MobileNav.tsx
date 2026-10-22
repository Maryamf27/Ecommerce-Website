"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function MobileNav() {
  const { user, signingOut, error: logoutError, logout } = useAuth();
  const [open, setOpen] = useState(false);

  async function signOut() {
    setOpen(false);
    await logout("/");
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
            {user ? <><Link href="/account" onClick={() => setOpen(false)}>My account</Link><Link href="/orders" onClick={() => setOpen(false)}>My orders</Link><Link href="/wishlist" onClick={() => setOpen(false)}>Wishlist</Link>{user.role === "admin" && <Link href="/admin" onClick={() => setOpen(false)}>Admin dashboard</Link>}<button className="mobile-signout" type="button" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</button>{logoutError && <p className="auth-nav-error mobile-logout-error" role="alert">{logoutError}</p>}</> : <><Link href="/login" onClick={() => setOpen(false)}>Sign in</Link><Link href="/register" onClick={() => setOpen(false)}>Create account</Link></>}
          </nav>
        </div>
      )}
    </>
  );
}
