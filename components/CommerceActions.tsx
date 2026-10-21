"use client";

import { Heart, ShoppingBag } from "lucide-react";
import type { ProductDTO } from "@/types/product";
import { useCommerce } from "@/components/CommerceProvider";

export function AddToCartButton({ product, className = "commerce-add-button" }: { product: ProductDTO; className?: string }) {
  const { addToCart } = useCommerce();
  const unavailable = product.stock < 1;
  return <button className={className} type="button" disabled={unavailable} onClick={() => void addToCart(product)} aria-label={unavailable ? `${product.title} is out of stock` : `Add ${product.title} to cart`} title={unavailable ? "This product is currently out of stock." : undefined}>
    <ShoppingBag size={15} aria-hidden="true" />{unavailable ? "Out of stock" : "Add to cart"}
  </button>;
}

export function WishlistButton({ product, className = "commerce-wishlist-button" }: { product: ProductDTO; className?: string }) {
  const { wishlistItems, toggleWishlist } = useCommerce();
  const selected = wishlistItems.some((item) => item._id === product._id);
  return <button className={`${className}${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} aria-label={selected ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`} onClick={() => void toggleWishlist(product)}>
    <Heart size={17} fill={selected ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}
