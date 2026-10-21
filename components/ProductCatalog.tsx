"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ProductDTO } from "@/types/product";

type ProductsResponse = {
  success: boolean;
  data?: ProductDTO[];
  error?: { message?: string };
};

export default function ProductCatalog() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    fetch("/api/products?limit=8&sort=rating_desc")
      .then(async (response) => {
        const payload = await response.json() as ProductsResponse;
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
          throw new Error(payload.error?.message ?? "Could not load products.");
        }
        return payload.data;
      })
      .then((items) => {
        if (!active) return;
        setProducts(items);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => { active = false; };
  }, [reloadKey]);

  return (
    <section className="featured" id="categories" aria-labelledby="products-heading">
      <div className="section-heading">
        <div><span className="section-kicker">OUR COLLECTION</span><h2 id="products-heading">Featured Products</h2></div>
        <a className="text-link" href="#shop">Browse products</a>
      </div>

      {status === "loading" && (
        <div className="product-grid" aria-label="Loading products" aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => <div className="product-card product-skeleton" key={index}><div className="skeleton-media"/><div className="skeleton-line"/><div className="skeleton-line short"/></div>)}
        </div>
      )}

      {status === "error" && (
        <div className="catalog-message" role="alert"><p>Products could not be loaded right now.</p><button className="retry-button" type="button" onClick={() => { setStatus("loading"); setReloadKey((key) => key + 1); }}>Try again</button></div>
      )}

      {status === "ready" && products.length === 0 && <p className="catalog-message" role="status">No products are available yet.</p>}

      {status === "ready" && products.length > 0 && (
        <div className="product-grid" id="shop">
          {products.map((product) => (
            <article className="product-card" key={product._id}>
              <div className="product-visual product-image-wrap"><Image src={product.image} alt={product.title} fill sizes="(max-width: 620px) 44vw, (max-width: 950px) 21vw, 170px" className="product-image" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}/></div>
              <p className="product-category">{product.category}</p>
              <h3 title={product.title}>{product.title}</h3>
              <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>({product.rating.count})</small></div>
              <p className="product-price">${product.price.toFixed(2)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
