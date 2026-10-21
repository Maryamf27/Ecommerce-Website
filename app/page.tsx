import Image from "next/image";
import ProductCatalog from "@/components/ProductCatalog";
import FeaturedProduct from "@/components/FeaturedProduct";
import StoreHeader from "@/components/StoreHeader";

export const instant = false;

export default async function Home({ searchParams }: { searchParams: Promise<{ search?: string; category?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  return (
    <>
      <StoreHeader />
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
        <ProductCatalog initialSearch={params.search} initialCategory={params.category} initialMinPrice={params.minPrice} initialMaxPrice={params.maxPrice} initialSort={params.sort} initialPage={page} title="Featured products" pageSize={8} />
      </main>
    </>
  );
}
