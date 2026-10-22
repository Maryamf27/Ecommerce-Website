"use client";

import { useState } from "react";
import { Check, Heart, ShoppingBag } from "lucide-react";
import type { ProductDTO } from "@/types/product";
import { useCommerce } from "@/components/CommerceProvider";
import { useAuth } from "@/components/AuthProvider";

export function AddToCartButton({ product, className = "commerce-add-button" }: { product: ProductDTO; className?: string }) {
  const { addToCart, cartItems } = useCommerce();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const inCart = cartItems.find((item) => item.product._id === product._id)?.quantity ?? 0;
  const outOfStock = product.stock < 1;
  const isAdmin = user?.role === "admin";
  const atLimit = inCart >= Math.min(product.stock, 99);

  async function add() {
    if (busy) return;
    setBusy(true);
    try { await addToCart(product); } finally { setBusy(false); }
  }

  if (isAdmin) return null;
  const label = outOfStock ? "Out of stock" : busy ? "Adding…" : atLimit && inCart > 0 ? `All ${inCart} in cart` : inCart > 0 ? `In cart (${inCart}) · Add more` : "Add to cart";
  const Icon = inCart > 0 && !busy ? Check : ShoppingBag;
  return <button className={`${className}${inCart > 0 ? " is-in-cart" : ""}`} type="button" disabled={outOfStock || busy || atLimit} onClick={() => void add()}
    aria-label={outOfStock ? `${product.title} is out of stock` : inCart > 0 ? `${product.title}: ${inCart} in cart. Add another` : `Add ${product.title} to cart`}
    title={outOfStock ? "This product is currently out of stock." : atLimit && inCart > 0 ? "You have added all available stock." : inCart > 0 ? "Already in your cart — click to add another." : undefined}>
    <Icon size={15} aria-hidden="true" />{label}
  </button>;
}

export function WishlistButton({ product, className = "commerce-wishlist-button" }: { product: ProductDTO; className?: string }) {
  const { wishlistItems, toggleWishlist } = useCommerce();
  const { user } = useAuth();
  if (user?.role === "admin") return null;
  const selected = wishlistItems.some((item) => item._id === product._id);
  return <button className={`${className}${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} aria-label={selected ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`} onClick={() => void toggleWishlist(product)}>
    <Heart size={17} fill={selected ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}
