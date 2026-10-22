import Link from "next/link";
import type { ProductDTO } from "@/types/product";

export default function FeaturedProduct({ product }: { product: ProductDTO | null }) {
  return <div className="hero-copy">
    <p className="hero-kicker">Featured Product</p>
    <h1>Find your <span className="hero-title-gradient">next favorite.</span></h1>
    <p className="hero-subtitle">Discover everyday essentials, standout accessories, and products you&apos;ll love.</p>
    {product ? <>
      <p className="hero-product-title">{product.title}</p>
      <p className="hero-product-price">${product.price.toFixed(2)}</p>
      <Link className="primary-button" href={`/products/${product._id}`}>View product</Link>
    </> : <Link className="primary-button" href="/shop#shop">Shop Collection</Link>}
  </div>;
}
