import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import WishlistPageContent from "@/components/WishlistPageContent";
import { redirectAdminAway } from "@/lib/customer-guard";

export const metadata: Metadata = { title: "Your wishlist | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function WishlistPage() {
  await redirectAdminAway();
  return <><StoreHeader /><WishlistPageContent /></>;
}
