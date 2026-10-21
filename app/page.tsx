import Image from "next/image";
import { Search, ShoppingCart } from "lucide-react";
import ProductCatalog from "@/components/ProductCatalog";

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#home" aria-label="R Audio home">R</a>
          <nav aria-label="Main navigation">
            <a className="active" href="#home">Home</a>
            <a href="#shop">Shop</a>
            <a href="#categories">Categories</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <a className="icon-button" href="#shop" aria-label="Search products"><Search size={19} strokeWidth={1.8}/></a>
            <a className="icon-button cart-icon" href="#shop" aria-label="Cart preview"><ShoppingCart size={20} strokeWidth={1.8}/><span>0</span></a>
          </div>
        </div>
      </header>
      <main className="store-shell">
        <section className="hero" id="home">
          <div className="hero-copy"><h1>Premium Sound</h1><p>Experience audio like never before</p><a className="primary-button" href="#shop">Shop Now</a></div>
          <div className="hero-visual" aria-label="Purple over-ear headphones"><div className="hero-glow"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><Image src="/headphone.png" width={1024} height={1024} alt="Purple over-ear headphones" className="hero-headphones" priority/></div>
        </section>
        <ProductCatalog />
        <footer id="about"><a className="footer-brand" href="#home">R <span>AUDIO</span></a><span>Thoughtful sound for everyday life.</span><span>© 2026 R Audio</span></footer>
      </main>
    </>
  );
}
