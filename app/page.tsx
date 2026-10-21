import Image from "next/image";
import { Search, ShoppingCart } from "lucide-react";
import ProductCatalog from "@/components/ProductCatalog";
import MobileNav from "@/components/MobileNav";
import FeaturedProduct from "@/components/FeaturedProduct";

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#home" aria-label="Nexora home">Nexora</a>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a className="active" href="#home">Home</a>
            <a href="#shop">Shop</a>
            <a href="#categories">Categories</a>
          </nav>
          <div className="header-actions">
            <a className="icon-button" href="#shop" aria-label="Search products"><Search size={19} strokeWidth={1.8}/></a>
            <a className="icon-button cart-icon" href="#shop" aria-label="Cart preview"><ShoppingCart size={20} strokeWidth={1.8}/><span>0</span></a>
            <MobileNav />
          </div>
        </div>
      </header>
      <main className="store-shell">
        <section className="hero" id="home">
          <FeaturedProduct />
          <div className="hero-visual" aria-label="Premium over-ear headphones — featured product">
            <div className="hero-glow"/>
            <div className="orbit orbit-one"/>
            <div className="orbit orbit-two"/>
            <Image
              src="/headphone.png"
              width={1024}
              height={1024}
              alt="Premium over-ear headphones"
              className="hero-headphones"
              priority
            />
          </div>
        </section>
        <ProductCatalog />
      </main>
    </>
  );
}
