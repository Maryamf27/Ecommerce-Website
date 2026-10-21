"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductImage from "@/components/ProductImage";
import type { ProductDTO } from "@/types/product";
import { AddToCartButton, WishlistButton } from "@/components/CommerceActions";

type DetailResponse = { success: boolean; data?: ProductDTO; error?: { message?: string } };

export default function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const description = product?.description.trim() ?? "";
  const descriptionPreview = description.length > 280
    ? `${description.slice(0, 280).replace(/\s+\S*$/, "")}…`
    : description;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as DetailResponse;
        if (response.status === 404 || response.status === 400) return { kind: "not-found" as const };
        if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message ?? "Product details could not be loaded.");
        return { kind: "ready" as const, product: payload.data };
      })
      .then((result) => {
        if (result.kind === "not-found") setState("not-found");
        else { setProduct(result.product); setState("ready"); }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [id, retry]);

  return <main className="product-detail-shell">
    <nav className="product-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/shop">Shop</Link>
      {state === "ready" && product && <><span aria-hidden="true">/</span><Link href={`/shop?category=${encodeURIComponent(product.category)}#shop`}>{product.category}</Link></>}
    </nav>
    {state === "loading" && <div className="product-detail product-detail-loading" aria-busy="true" aria-label="Loading product"><div className="detail-skeleton-media"/><div><div className="skeleton-line"/><div className="skeleton-line"/><div className="skeleton-line short"/></div></div>}
    {state === "error" && <div className="catalog-message" role="alert"><p>Product details are temporarily unavailable.</p><button className="retry-button" type="button" onClick={() => { setState("loading"); setProduct(null); setRetry((current) => current + 1); }}>Try again</button></div>}
    {state === "not-found" && <div className="catalog-message" role="status"><h1>Product not found</h1><p>This product may have been removed or the link may be incorrect.</p><Link href="/shop" className="text-link">Browse the shop</Link></div>}
    {state === "ready" && product && <article className="product-detail">
      <div className="product-detail-image"><ProductImage src={product.image} alt={product.title} sizes="(max-width: 700px) 90vw, 45vw" priority /></div>
      <div className="product-detail-copy">
        <Link href={`/shop?category=${encodeURIComponent(product.category)}#shop`} className="product-category product-category-link">{product.category}</Link>
        <h1>{product.title}</h1>
        {product.rating.count > 0 && <div className="product-rating product-detail-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>{product.rating.rate.toFixed(1)} <span aria-hidden="true">·</span> {product.rating.count} ratings</small></div>}
        <div className="product-price-panel"><span>Price</span><p className="product-detail-price">${product.price.toFixed(2)}</p></div>
        <div className="product-detail-commerce"><AddToCartButton product={product} /><WishlistButton product={product} className="commerce-wishlist-button detail-wishlist-button" /></div>
        <section className="product-description-section" aria-labelledby="description-heading">
          <h2 id="description-heading">Product details</h2>
          <p className="product-description">{descriptionPreview}</p>
          {description.length > 280 && <details className="description-disclosure"><summary>Read full description</summary><p>{description}</p></details>}
        </section>
        {product.stockStatus === "in-stock" && <p className="product-stock"><span aria-hidden="true" className="stock-indicator"/>{product.stock} in stock</p>}
        {product.stockStatus === "low-stock" && <p className="product-stock product-stock-low"><span aria-hidden="true" className="stock-indicator"/>Only {product.stock} left in stock</p>}
        {product.stockStatus === "out-of-stock" && <p className="product-stock-unavailable">Out of stock</p>}
        <div className="product-detail-actions"><Link className="product-category-action" href={`/shop?category=${encodeURIComponent(product.category)}#shop`}>Explore {product.category}</Link><Link className="product-back-link" href="/shop">Continue shopping <span aria-hidden="true">→</span></Link></div>
      </div>
    </article>}
  </main>;
}
