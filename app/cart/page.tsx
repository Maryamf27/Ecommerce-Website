import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import CartPageContent from "@/components/CartPageContent";
import { redirectAdminAway } from "@/lib/customer-guard";

export const metadata: Metadata = { title: "Shopping cart | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function CartPage() {
  await redirectAdminAway();
  return <><StoreHeader /><CartPageContent /></>;
}
