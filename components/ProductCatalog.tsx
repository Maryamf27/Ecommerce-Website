"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ProductDTO } from "@/types/product";

type ProductsResponse = {
  success: boolean;
  data?: ProductDTO[];
  pagination?: { page: number; pages: number; total: number };
  error?: { message?: string };
};

export default function ProductCatalog() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/products?limit=48&sort=newest")
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error("Could not load categories.");
        return payload.data;
      })
      .then((items) => { if (active) setCategories([...new Set(items.map((item) => item.category))].sort()); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: "8", page: String(page), sort });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    fetch(`/api/products?${params}`)
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error("Could not load products.");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setProducts(payload.data ?? []);
        setPages(payload.pagination?.pages ?? 1);
        setStatus("ready");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [search, category, sort, page, reloadKey]);

  const resetPage = () => setPage(1);
  return (
    <section className="featured" id="categories" aria-labelledby="products-heading">
      <div className="section-heading">
        <div><span className="section-kicker">OUR COLLECTION</span><h2 id="products-heading">Featured Products</h2></div>
        <a className="text-link" href="#shop">Browse products</a>
      </div>
      <div className="catalog-controls" id="shop">
        <label className="catalog-search"><span className="sr-only">Search products</span><input value={search} onChange={(event) => { setStatus("loading"); setSearch(event.target.value); resetPage(); }} placeholder="Search products" /></label>
        <label><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => { setStatus("loading"); setCategory(event.target.value); resetPage(); }}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => { setStatus("loading"); setSort(event.target.value); resetPage(); }}><option value="newest">Recently added</option><option value="rating_desc">Top rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
      </div>
      {status === "loading" && <div className="product-grid" aria-label="Loading products" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div className="product-card product-skeleton" key={index}><div className="skeleton-media"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}</div>}
      {status === "error" && <div className="catalog-message" role="alert"><p>Products could not be loaded right now.</p><button className="retry-button" type="button" onClick={() => { setStatus("loading"); setReloadKey((key) => key + 1); }}>Try again</button></div>}
      {status === "ready" && products.length === 0 && <p className="catalog-message" role="status">No products match your search.</p>}
      {status === "ready" && products.length > 0 && <div className="product-grid">
        {products.map((product) => <article className="product-card" key={product._id}>
          <a className="product-visual product-image-wrap" href={`/products/${product._id}`} aria-label={`View ${product.title}`}><Image src={product.image} alt={product.title} fill sizes="(max-width: 620px) 44vw, (max-width: 950px) 21vw, 240px" className="product-image" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}/></a>
          <p className="product-category">{product.category}</p><h3 title={product.title}>{product.title}</h3>
          <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>({product.rating.count})</small></div>
          <p className="product-price">${product.price.toFixed(2)}</p><a className="product-action" href={`/products/${product._id}`}>View product</a>
        </article>)}
      </div>}
      {status === "ready" && pages > 1 && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => { setStatus("loading"); setPage((current) => current - 1); }}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => { setStatus("loading"); setPage((current) => current + 1); }}>Next</button></div>}
    </section>
  );
}
