"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductDTO } from "@/types/product";
import ProductImage from "@/components/ProductImage";
import Select from "@/components/Select";
import { AddToCartButton, WishlistButton } from "@/components/CommerceActions";
import { validatePriceRange } from "@/lib/price-filter";

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
  const sectionRef = useRef<HTMLElement>(null);
  const firstPage = useRef(page);
  // A number input reports "" for text it cannot parse ("e", "--"); remember that so it is not mistaken for "no filter".
  const [unparseable, setUnparseable] = useState({ min: false, max: false });
  const priceCheck = useMemo(
    () => validatePriceRange(minPrice, maxPrice, { minUnparseable: unparseable.min, maxUnparseable: unparseable.max }),
    [minPrice, maxPrice, unparseable],
  );
  const priceValid = priceCheck.ok;
  // Moving to another result page should start at the top of the list, not at the pagination buttons.
  useEffect(() => {
    if (firstPage.current === page) return;
    firstPage.current = page;
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: Math.max(top, 0), behavior: "instant" });
  }, [page]);

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
    // Never send an invalid price range to the API; the inline message explains what to fix instead.
    if (!priceValid) return;
    let active = true;
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page), sort });
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
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
  }, [search, category, minPrice, maxPrice, sort, page, pageSize, reloadKey, priceValid]);

  const updateFilter = (update: () => void) => {
    setStatus("loading");
    setPage(1);
    update();
  };

  return <section ref={sectionRef} className="featured" id="categories" aria-labelledby="products-heading">
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

    {search.trim() && <p className="catalog-search-summary" role="status">Results for <strong>“{search.trim()}”</strong><button type="button" onClick={() => updateFilter(() => setSearch(""))} aria-label="Clear search">Clear</button></p>}

    <div className="catalog-controls" id="shop">
      <div className="catalog-select"><Select label="Filter by category" value={category} onChange={(next) => updateFilter(() => setCategory(next))} options={[{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item, label: item }))]} /></div>
      <div className="catalog-select"><Select label="Sort products" value={sort} onChange={(next) => updateFilter(() => setSort(next))} options={[{ value: "newest", label: "Recently added" }, { value: "rating_desc", label: "Top rated" }, { value: "price_asc", label: "Price: low to high" }, { value: "price_desc", label: "Price: high to low" }]} /></div>
      <label className="catalog-price-input"><span className="sr-only">Minimum price</span><input type="number" min="0" step="1" inputMode="decimal" value={minPrice} onChange={(event) => { const bad = event.target.validity.badInput; setUnparseable((current) => ({ ...current, min: bad })); updateFilter(() => setMinPrice(event.target.value)); }} placeholder="Min price ($)" aria-invalid={!priceCheck.ok && priceCheck.code !== "invalid-max"} aria-describedby={priceCheck.ok ? undefined : "catalog-price-error"} /></label>
      <label className="catalog-price-input"><span className="sr-only">Maximum price</span><input type="number" min="0" step="1" inputMode="decimal" value={maxPrice} onChange={(event) => { const bad = event.target.validity.badInput; setUnparseable((current) => ({ ...current, max: bad })); updateFilter(() => setMaxPrice(event.target.value)); }} placeholder="Max price ($)" aria-invalid={!priceCheck.ok && priceCheck.code !== "invalid-min"} aria-describedby={priceCheck.ok ? undefined : "catalog-price-error"} /></label>
    </div>
    {!priceCheck.ok && <p className="catalog-price-error" id="catalog-price-error" role="alert">{priceCheck.message}</p>}

    {priceValid && status === "loading" && <div className="product-grid" aria-label="Loading products" aria-busy="true">{Array.from({ length: Math.min(pageSize, 4) }, (_, index) => <div className="product-card product-skeleton" key={index}><div className="skeleton-media"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}</div>}
    {priceValid && status === "error" && <div className="catalog-message" role="alert"><p>Products could not be loaded right now.</p><button className="retry-button" type="button" onClick={() => { setStatus("loading"); setReloadKey((key) => key + 1); }}>Try again</button></div>}
    {priceValid && status === "ready" && products.length === 0 && <p className="catalog-message" role="status">{search.trim() ? `No products found for “${search.trim()}”. Try a different word or clear your filters.` : "No products match these filters."}</p>}
    {priceValid && status === "ready" && products.length > 0 && <div className="product-grid">
      {products.map((product) => <article className="product-card" key={product._id}>
        <Link className="product-visual product-image-wrap" href={`/products/${product._id}`} aria-label={`View ${product.title}`}><ProductImage src={product.image} alt={product.title} sizes="(max-width: 620px) 44vw, (max-width: 950px) 21vw, 240px" className="product-image" /></Link>
        <p className="product-category">{product.category}</p><h3 title={product.title}>{product.title}</h3>
        {product.rating.count > 0 ? <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>{product.rating.rate.toFixed(1)} ({product.rating.count})</small></div> : <div className="product-rating product-rating-empty" aria-hidden="true" />}
        <p className="product-price">${product.price.toFixed(2)}</p><p className={`product-stock-label ${product.stockStatus}`} aria-label={`Stock: ${product.stockStatus === "low-stock" ? `${product.stock} left` : product.stockStatus === "out-of-stock" ? "out of stock" : "in stock"}`}><span aria-hidden="true" />{product.stockStatus === "out-of-stock" ? "Out of stock" : product.stockStatus === "low-stock" ? `Only ${product.stock} left` : "In stock"}</p><div className="product-card-actions"><Link className="product-action" href={`/products/${product._id}`}>View product</Link><WishlistButton product={product} /><AddToCartButton product={product} /></div>
      </article>)}
    </div>}
    {priceValid && status === "ready" && pages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => { setStatus("loading"); setPage((current) => current - 1); }}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => { setStatus("loading"); setPage((current) => current + 1); }}>Next</button></nav>}
  </section>;
}
