import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import CheckoutForm from "@/components/CheckoutForm";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

export const metadata: Metadata = { title: "Checkout | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Fcheckout");
  let savedAddress: { address: string; city: string; postalCode: string; country: string; name: string } | null = null;
  try {
    await connectToDatabase();
    const record = await User.findById(user.id).select("savedAddress").lean<{ savedAddress?: { address: string; city: string; postalCode: string; country: string; name: string } } | null>();
    if (record?.savedAddress) savedAddress = { name: record.savedAddress.name, address: record.savedAddress.address, city: record.savedAddress.city, postalCode: record.savedAddress.postalCode, country: record.savedAddress.country };
  } catch (error) { logServerError("checkout saved address", error); }
  return <><StoreHeader /><CheckoutForm user={user} savedAddress={savedAddress} /></>;
}
