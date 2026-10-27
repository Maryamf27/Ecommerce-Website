import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import AuthForm from "@/components/AuthForm";
import { safeReturnTo } from "@/lib/auth-validation";

export const metadata: Metadata = { title: "Sign in | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  return <><StoreHeader/><AuthForm mode="login" returnTo={safeReturnTo(typeof params.next === "string" ? params.next : undefined, "/")}/></>;
}
