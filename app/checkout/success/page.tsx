import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import CheckoutSuccess from "@/components/CheckoutSuccess";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const metadata: Metadata = { title: "Order status | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const cookieStore = await cookies();
  if (!await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/login?next=%2Faccount");
  const { session_id: sessionId } = await searchParams;
  return <><StoreHeader /><CheckoutSuccess sessionId={sessionId ?? ""} /></>;
}
