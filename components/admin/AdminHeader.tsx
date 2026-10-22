"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Store } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/** Header for the admin dashboard: no cart, wishlist or customer-order shortcuts. */
export default function AdminHeader() {
  const { user, signingOut, logout } = useAuth();
  return <header className="topbar admin-topbar">
    <div className="topbar-inner">
      <Link className="brand" href="/admin" aria-label="Nexora admin dashboard">Nexora</Link>
      <span className="admin-badge">Admin</span>
      <nav className="admin-header-nav" aria-label="Admin navigation">
        <Link href="/admin"><LayoutDashboard size={16} aria-hidden="true" /><span>Dashboard</span></Link>
        <Link href="/shop"><Store size={16} aria-hidden="true" /><span>View store</span></Link>
      </nav>
      <div className="admin-header-user">
        {user && <span className="admin-header-name" title={user.email}>{user.name.split(/\s+/)[0]}</span>}
        <button type="button" className="admin-signout" onClick={() => void logout("/")} disabled={signingOut} aria-label="Sign out"><LogOut size={16} aria-hidden="true" /><span>{signingOut ? "Signing out…" : "Sign out"}</span></button>
      </div>
    </div>
  </header>;
}
