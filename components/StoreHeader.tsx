import Link from "next/link";
import { Search } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import AuthNav from "@/components/AuthNav";

export default function StoreHeader() {
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
        <AuthNav />
        <MobileNav />
      </div>
    </div>
  </header>;
}
