"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccountLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sign-out failed. Please try again.");
      setPending(false);
    }
  }

  return <div className="account-logout"><button className="auth-submit" type="button" onClick={logout} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</div>;
}
