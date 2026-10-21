import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import WishlistPageContent from "@/components/WishlistPageContent";

export const metadata: Metadata = { title: "Your wishlist | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default function WishlistPage() {
  return <><StoreHeader /><WishlistPageContent /></>;
}
