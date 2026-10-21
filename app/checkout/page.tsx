import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import CheckoutForm from "@/components/CheckoutForm";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const metadata: Metadata = { title: "Checkout | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Fcheckout");
  return <><StoreHeader /><CheckoutForm user={user} /></>;
}
