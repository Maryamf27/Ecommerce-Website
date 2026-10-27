import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import AuthForm from "@/components/AuthForm";
import { safeReturnTo } from "@/lib/auth-validation";

export const metadata: Metadata = { title: "Create account | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  // Honour ?next= (set by the login page and the checkout redirect) so new customers return to checkout.
  return <><StoreHeader/><AuthForm mode="register" returnTo={safeReturnTo(typeof params.next === "string" ? params.next : undefined, "/")}/></>;
}
