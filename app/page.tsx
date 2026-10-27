import Image from "next/image";
import Link from "next/link";
import ProductCatalog from "@/components/ProductCatalog";
import FeaturedProduct from "@/components/FeaturedProduct";
import StoreHeader from "@/components/StoreHeader";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import { ensureHeadphoneProduct } from "@/services/product-service";
import type { ProductDTO } from "@/types/product";

export const instant = false;

export default async function Home({ searchParams }: { searchParams: Promise<{ search?: string; category?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  let featured: ProductDTO | null = null;
  try {
    await connectToDatabase();
    featured = (await ensureHeadphoneProduct()).product;
  } catch (error) { logServerError("home featured headphone", error); }

  const heroImage = <Image
    src="/headphone.png"
    width={1024}
    height={1024}
    alt={featured ? `${featured.title} — view product` : "Premium over-ear headphones"}
    className="hero-headphones"
    priority
  />;

  return (
    <>
      <StoreHeader />
      <main className="store-shell">
        <section className="hero" id="home">
          <FeaturedProduct product={featured} />
          {featured
            ? <Link className="hero-visual hero-visual-link" href={`/products/${featured._id}`} aria-label={`View ${featured.title}`}>
              <div className="hero-glow"/>
              <div className="orbit orbit-one"/>
              <div className="orbit orbit-two"/>
              {heroImage}
              <span className="hero-visual-hint" aria-hidden="true">View product →</span>
            </Link>
            : <div className="hero-visual" aria-label="Premium over-ear headphones — featured product">
              <div className="hero-glow"/>
              <div className="orbit orbit-one"/>
              <div className="orbit orbit-two"/>
              {heroImage}
            </div>}
        </section>
        <ProductCatalog initialSearch={params.search} initialCategory={params.category} initialMinPrice={params.minPrice} initialMaxPrice={params.maxPrice} initialSort={params.sort} initialPage={page} title="Featured products" pageSize={8} />
      </main>
    </>
  );
}
