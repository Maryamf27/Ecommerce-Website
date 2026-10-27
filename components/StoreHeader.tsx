"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Search, ShoppingBag } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import AuthNav from "@/components/AuthNav";
import { useCommerce } from "@/components/CommerceProvider";
import { useAuth } from "@/components/AuthProvider";

export default function StoreHeader() {
  const { cartCount, wishlistCount, ready } = useCommerce();
  const { user } = useAuth();
  const onWishlist = usePathname() === "/wishlist";
  const isAdmin = user?.role === "admin";
  return <header className="topbar">
    <div className="topbar-inner">
      <Link className="brand" href="/" aria-label="Nexora home">Nexora</Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/shop#categories">Categories</Link>
      </nav>
      <div className="header-actions">
        <Link className="icon-button" href="/shop#shop" aria-label="Search products"><Search size={19} strokeWidth={1.8} /></Link>
        {!isAdmin && <Link className={`icon-button count-icon${onWishlist ? " is-active-wishlist" : ""}`} href="/wishlist" aria-current={onWishlist ? "page" : undefined} aria-label={ready ? `Wishlist, ${wishlistCount} ${wishlistCount === 1 ? "item" : "items"}` : "Wishlist"}><Heart size={18} strokeWidth={1.8} fill={onWishlist ? "currentColor" : "none"} />{ready && <span>{wishlistCount > 99 ? "99+" : wishlistCount}</span>}</Link>}
        {!isAdmin && <Link className="icon-button count-icon" href="/cart" aria-label={ready ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"}><ShoppingBag size={18} strokeWidth={1.8} />{ready && <span key={cartCount} className="count-bump">{cartCount > 99 ? "99+" : cartCount}</span>}</Link>}
        <AuthNav />
        <MobileNav />
      </div>
    </div>
  </header>;
}
