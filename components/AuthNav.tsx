"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, LogOut, Package, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthNav() {
  const { user, loaded, signingOut, error, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!loaded) return <span className="auth-nav-placeholder" aria-hidden="true" />;
  if (!user) return <nav className="auth-nav" aria-label="Account navigation"><Link href="/login">Sign in</Link><Link className="auth-register-link" href="/register">Join</Link></nav>;

  const close = () => setOpen(false);
  return <div className="user-menu" ref={menuRef}>
    <button type="button" className="user-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="user-menu-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
      <span className="user-menu-name">{user.name.split(/\s+/)[0]}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div className="user-menu-panel" role="menu">
      <div className="user-menu-head"><strong>{user.name}</strong><span>{user.email}</span></div>
      <Link role="menuitem" href="/account" onClick={close}><User size={15} aria-hidden="true" />My account</Link>
      {user.role !== "admin" && <><Link role="menuitem" href="/orders" onClick={close}><Package size={15} aria-hidden="true" />My orders</Link>
      <Link role="menuitem" href="/wishlist" onClick={close}><Heart size={15} aria-hidden="true" />Wishlist</Link></>}
      {user.role === "admin" && <Link role="menuitem" href="/admin" onClick={close}><ShieldCheck size={15} aria-hidden="true" />Admin dashboard</Link>}
      <span className="user-menu-divider" />
      <button role="menuitem" type="button" onClick={() => { close(); void logout(); }} disabled={signingOut}><LogOut size={15} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button>
      {error && <span className="auth-nav-error" role="alert">{error}</span>}
    </div>}
  </div>;
}
