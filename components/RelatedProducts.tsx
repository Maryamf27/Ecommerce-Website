"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductDTO } from "@/types/product";
import ProductImage from "@/components/ProductImage";
import { AddToCartButton, WishlistButton } from "@/components/CommerceActions";

type ProductsResponse = { success: boolean; data?: ProductDTO[] };

const MAX_RELATED = 12;

/**
 * "More in this category" slider shown under the product details.
 * Loads other products of the same category (excluding the current one) and
 * lets the shopper scroll them with the arrows, touch swipe or the trackpad.
 */
export default function RelatedProducts({ category, currentId }: { category: string; currentId: string }) {
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ category, limit: String(MAX_RELATED + 1), sort: "rating_desc" });
    fetch(`/api/products?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error("Could not load related products.");
        return payload.data;
      })
      .then((products) => {
        setItems(products.filter((product) => product._id !== currentId).slice(0, MAX_RELATED));
        setStatus("ready");
        if (trackRef.current) trackRef.current.scrollLeft = 0;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [category, currentId]);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [items, updateArrows]);

  const slide = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.85, 240), behavior: "smooth" });
  };

  // Nothing to recommend (or the request failed): stay out of the way instead of showing an empty block.
  if (status === "error" || (status === "ready" && items.length === 0)) return null;

  return <section className="related-products" aria-labelledby="related-heading">
    <div className="related-heading">
      <div>
        <span className="section-kicker">YOU MAY ALSO LIKE</span>
        <h2 id="related-heading">More in {category}</h2>
      </div>
      {status === "ready" && <div className="related-arrows">
        <button type="button" className="related-arrow" onClick={() => slide(-1)} disabled={!canPrev} aria-label="Previous products"><ChevronLeft size={20} aria-hidden="true" /></button>
        <button type="button" className="related-arrow" onClick={() => slide(1)} disabled={!canNext} aria-label="Next products"><ChevronRight size={20} aria-hidden="true" /></button>
      </div>}
    </div>

    {status === "loading" && <div className="page-loading-center" role="status" aria-busy="true"><span className="spinner" aria-hidden="true" /><span className="sr-only">Loading related products…</span></div>}

    {status === "ready" && <div className="related-track" ref={trackRef} onScroll={updateArrows} role="list" tabIndex={0} aria-label={`More products in ${category}`}>
      {items.map((product) => <article className="product-card related-card" role="listitem" key={product._id}>
        <Link className="product-visual product-image-wrap" href={`/products/${product._id}`} aria-label={`View ${product.title}`}><ProductImage src={product.image} alt={product.title} sizes="(max-width: 620px) 60vw, 240px" className="product-image" /></Link>
        <p className="product-category">{product.category}</p>
        <h3 title={product.title}>{product.title}</h3>
        {product.rating.count > 0 ? <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>{product.rating.rate.toFixed(1)} ({product.rating.count})</small></div> : <div className="product-rating product-rating-empty" aria-hidden="true" />}
        <p className="product-price">${product.price.toFixed(2)}</p>
        <p className={`product-stock-label ${product.stockStatus}`}><span aria-hidden="true" />{product.stockStatus === "out-of-stock" ? "Out of stock" : product.stockStatus === "low-stock" ? `Only ${product.stock} left` : "In stock"}</p>
        <div className="product-card-actions"><Link className="product-action" href={`/products/${product._id}`}>View product</Link><WishlistButton product={product} /><AddToCartButton product={product} /></div>
      </article>)}
    </div>}
  </section>;
}
