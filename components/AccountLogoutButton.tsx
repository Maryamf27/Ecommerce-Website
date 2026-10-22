"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AccountLogoutButton() {
  const { signingOut, error, logout } = useAuth();
  return <div className="account-logout"><button className="auth-submit" type="button" onClick={() => void logout("/")} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</div>;
}
