"use client";

import { useEffect, useState } from "react";
import type { ProductDTO } from "@/types/product";

export default function FeaturedProduct() {
  const [product, setProduct] = useState<ProductDTO | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/products?limit=48&sort=rating_desc")
      .then((response) => response.json())
      .then((payload: { success?: boolean; data?: ProductDTO[] }) => {
        const match = payload.success ? payload.data?.find((item) => /headphones?|headsets?/i.test(`${item.title} ${item.category}`)) : undefined;
        if (active && match) setProduct(match);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return <div className="hero-copy">
    <p className="hero-kicker">Featured Product</p>
    <h1>Find your next favorite.</h1>
    <p className="hero-subtitle">Discover everyday essentials, standout accessories, and products you&apos;ll love.</p>
    {product ? <>
      <p className="hero-product-title">{product.title}</p>
      <p className="hero-product-price">${product.price.toFixed(2)}</p>
      <a className="primary-button" href={`/products/${product._id}`}>View featured product</a>
    </> : <a className="primary-button" href="#shop">Shop Collection</a>}
  </div>;
}
