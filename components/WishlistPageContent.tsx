"use client";

import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useCommerce } from "@/components/CommerceProvider";

export default function WishlistPageContent() {
  const { wishlistItems, loading, error, removeFromWishlist, addWishlistToCart } = useCommerce();
  return <main className="commerce-page">
    <div className="commerce-page-heading"><p className="auth-kicker">SAVED FOR LATER</p><h1>Your wishlist</h1><p>{wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"}</p></div>
    {error && <p className="commerce-error" role="alert">{error}</p>}
    {loading ? <p className="commerce-state" role="status">Loading your wishlist…</p> : wishlistItems.length === 0 ? <section className="commerce-state"><h2>Your wishlist is empty</h2><p>Save products you like and come back to them any time.</p><Link className="commerce-primary-link" href="/shop">Explore the shop</Link></section> : <div className="wishlist-grid">{wishlistItems.map((product) => <article className="wishlist-card" key={product._id}>
      <Link className="wishlist-image" href={`/products/${product._id}`}><ProductImage src={product.image} alt={product.title} sizes="(max-width: 620px) 42vw, 220px" /></Link>
      <p className="product-category">{product.category}</p><Link href={`/products/${product._id}`}><h2>{product.title}</h2></Link><p className="product-price">${product.price.toFixed(2)}</p>
      <div className="wishlist-card-actions"><button className="commerce-add-button" type="button" disabled={product.stock < 1} title={product.stock < 1 ? "This product is currently out of stock." : undefined} onClick={() => void addWishlistToCart(product)}>{product.stock > 0 ? "Add to cart" : "Out of stock"}</button><button className="commerce-text-button" type="button" onClick={() => void removeFromWishlist(product._id)}>Remove</button></div>
    </article>)}</div>}
  </main>;
}
