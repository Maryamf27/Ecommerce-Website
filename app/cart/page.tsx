import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import CartPageContent from "@/components/CartPageContent";

export const metadata: Metadata = { title: "Shopping cart | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default function CartPage() {
  return <><StoreHeader /><CartPageContent /></>;
}
