import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import AccountLogoutButton from "@/components/AccountLogoutButton";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const metadata: Metadata = { title: "Your account | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Faccount");

  return <><StoreHeader/><main className="account-shell">
    <p className="auth-kicker">NEXORA ACCOUNT</p>
    <h1>Your account</h1>
    <p className="account-intro">Your profile details are below.</p>
    <section className="account-card" aria-label="Profile information">
      <div className="account-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
      <div className="account-details"><div><span>Name</span><p>{user.name}</p></div><div><span>Email address</span><p>{user.email}</p></div></div>
      <AccountLogoutButton/>
    </section>
  </main></>;
}
