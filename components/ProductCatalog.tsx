"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductDTO } from "@/types/product";
import ProductImage from "@/components/ProductImage";
import Select from "@/components/Select";
import { AddToCartButton, WishlistButton } from "@/components/CommerceActions";

type ProductsResponse = {
  success: boolean;
  data?: ProductDTO[];
  categories?: string[];
  pagination?: { page: number; pages: number; total: number };
  error?: { message?: string };
};

type ProductCatalogProps = {
  initialCategory?: string;
  initialSearch?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialSort?: string;
  initialPage?: number;
  title?: string;
  pageSize?: number;
  showCategories?: boolean;
};

export default function ProductCatalog({
  initialCategory = "",
  initialSearch = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialSort = "newest",
  initialPage = 1,
  title = "Featured products",
  pageSize = 8,
  showCategories = true,
}: ProductCatalogProps) {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (sort !== "newest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [search, category, minPrice, maxPrice, sort, page]);

  useEffect(() => {
    let active = true;
    fetch("/api/products?limit=1")
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.categories)) throw new Error("Could not load categories.");
        return payload.categories;
      })
      .then((items) => { if (active) setCategories(items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page), sort });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    fetch(`/api/products?${params}`)
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error(payload.error?.message ?? "Could not load products.");
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
  }, [search, category, minPrice, maxPrice, sort, page, pageSize, reloadKey]);

  const updateFilter = (update: () => void) => {
    setStatus("loading");
    setPage(1);
    update();
  };

  return <section className="featured" id="categories" aria-labelledby="products-heading">
    <div className="section-heading">
      <div><span className="section-kicker">OUR COLLECTION</span><h2 id="products-heading">{title}</h2></div>
      <Link className="text-link" href="/shop#shop">Browse products</Link>
    </div>

    {showCategories && categories.length > 0 && <nav className="category-browser" aria-label="Browse product categories">
      <span>Shop by category</span>
      <div className="category-links">
        <Link href="/shop#shop" className={!category ? "selected" : ""}>All</Link>
        {categories.map((item) => <Link className={category === item ? "selected" : ""} key={item} href={`/shop?category=${encodeURIComponent(item)}#shop`}>{item}</Link>)}
      </div>
    </nav>}

    <div className="catalog-controls" id="shop">
      <label className="catalog-search"><span className="sr-only">Search products</span><input value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Search products…" /></label>
      <div className="catalog-select"><Select label="Filter by category" value={category} onChange={(next) => updateFilter(() => setCategory(next))} options={[{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item, label: item }))]} /></div>
      <div className="catalog-select"><Select label="Sort products" value={sort} onChange={(next) => updateFilter(() => setSort(next))} options={[{ value: "newest", label: "Recently added" }, { value: "rating_desc", label: "Top rated" }, { value: "price_asc", label: "Price: low to high" }, { value: "price_desc", label: "Price: high to low" }]} /></div>
      <label className="catalog-price-input"><span className="sr-only">Minimum price</span><input type="number" min="0" step="0.01" value={minPrice} onChange={(event) => updateFilter(() => setMinPrice(event.target.value))} placeholder="Min price ($)" /></label>
      <label className="catalog-price-input"><span className="sr-only">Maximum price</span><input type="number" min="0" step="0.01" value={maxPrice} onChange={(event) => updateFilter(() => setMaxPrice(event.target.value))} placeholder="Max price ($)" /></label>
    </div>

    {status === "loading" && <div className="product-grid" aria-label="Loading products" aria-busy="true">{Array.from({ length: Math.min(pageSize, 4) }, (_, index) => <div className="product-card product-skeleton" key={index}><div className="skeleton-media"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}</div>}
    {status === "error" && <div className="catalog-message" role="alert"><p>Products could not be loaded right now.</p><button className="retry-button" type="button" onClick={() => { setStatus("loading"); setReloadKey((key) => key + 1); }}>Try again</button></div>}
    {status === "ready" && products.length === 0 && <p className="catalog-message" role="status">No products match these filters.</p>}
    {status === "ready" && products.length > 0 && <div className="product-grid">
      {products.map((product) => <article className="product-card" key={product._id}>
        <Link className="product-visual product-image-wrap" href={`/products/${product._id}`} aria-label={`View ${product.title}`}><ProductImage src={product.image} alt={product.title} sizes="(max-width: 620px) 44vw, (max-width: 950px) 21vw, 240px" className="product-image" /></Link>
        <p className="product-category">{product.category}</p><h3 title={product.title}>{product.title}</h3>
        {product.rating.count > 0 && <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>{product.rating.rate.toFixed(1)} ({product.rating.count})</small></div>}
        <p className="product-price">${product.price.toFixed(2)}</p><p className={`product-stock-label ${product.stockStatus}`} aria-label={`Stock: ${product.stockStatus === "low-stock" ? `${product.stock} left` : product.stockStatus === "out-of-stock" ? "out of stock" : "in stock"}`}><span aria-hidden="true" />{product.stockStatus === "out-of-stock" ? "Out of stock" : product.stockStatus === "low-stock" ? `Only ${product.stock} left` : "In stock"}</p><div className="product-card-actions"><Link className="product-action" href={`/products/${product._id}`}>View product</Link><WishlistButton product={product} /><AddToCartButton product={product} /></div>
      </article>)}
    </div>}
    {status === "ready" && pages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => { setStatus("loading"); setPage((current) => current - 1); }}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => { setStatus("loading"); setPage((current) => current + 1); }}>Next</button></nav>}
  </section>;
}
