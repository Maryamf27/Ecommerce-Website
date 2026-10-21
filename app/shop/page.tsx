import type { Metadata } from "next";
import ProductCatalog from "@/components/ProductCatalog";
import StoreHeader from "@/components/StoreHeader";

export const metadata: Metadata = {
  title: "Shop | Nexora",
  description: "Browse the full Nexora collection across everyday essentials and standout accessories.",
};

export const instant = false;

export default async function ShopPage({ searchParams }: {
  searchParams: Promise<{ category?: string | string[]; search?: string | string[]; minPrice?: string | string[]; maxPrice?: string | string[]; sort?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const value = (key: keyof typeof params, fallback = "") => typeof params[key] === "string" ? params[key] as string : fallback;
  const category = value("category");
  const page = Math.max(1, Number(value("page", "1")) || 1);
  return <>
    <StoreHeader />
    <main className="store-shell shop-shell">
      <section className="shop-intro">
        <p className="hero-kicker">NEXORA COLLECTION</p>
        <h1>Find something you&apos;ll love.</h1>
        <p>Explore products across categories, all in one place.</p>
      </section>
      <ProductCatalog key={`${category}:${value("search")}:${value("minPrice")}:${value("maxPrice")}:${value("sort")}:${page}`} initialCategory={category} initialSearch={value("search")} initialMinPrice={value("minPrice")} initialMaxPrice={value("maxPrice")} initialSort={value("sort", "newest")} initialPage={page} title="Shop all products" pageSize={12} showCategories />
    </main>
  </>;
}
