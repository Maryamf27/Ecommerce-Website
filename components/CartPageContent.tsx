"use client";

import { useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useCommerce } from "@/components/CommerceProvider";
import ProductImage from "@/components/ProductImage";

export default function CartPageContent() {
  const { cartItems, cartCount, loading, error, setQuantity, removeFromCart, clearCart } = useCommerce();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <main className="commerce-page">
      <div className="commerce-page-heading">
        <p className="auth-kicker">YOUR SELECTION</p>
        <h1>Shopping cart</h1>
        <p className="cart-item-count">{cartCount} {cartCount === 1 ? "item" : "items"}</p>
      </div>

      {error && <p className="commerce-error" role="alert">{error}</p>}

      {loading ? (
        <div className="commerce-state" role="status"><span className="spinner" aria-hidden="true" /><span>Loading your cart…</span></div>
      ) : cartItems.length === 0 ? (
        <section className="commerce-state">
          <h2>Your cart is empty</h2>
          <p>Find something you’ll love and it will be waiting here.</p>
          <Link className="commerce-primary-link" href="/shop">Continue shopping</Link>
        </section>
      ) : (
        <div className="cart-layout">
          <section className="cart-lines" aria-label="Items in your cart">
            {cartItems.map(({ product, quantity, lineTotal, available }) => (
              <article className="cart-line" key={product._id}>
                <Link className="cart-line-image" href={`/products/${product._id}`}>
                  <ProductImage src={product.image} alt={product.title} sizes="120px" />
                </Link>

                <div className="cart-line-info">
                  <Link href={`/products/${product._id}`} className="cart-line-title-link">
                    <h2 className="cart-line-title">{product.title}</h2>
                  </Link>
                  <p className="cart-line-category">{product.category}</p>
                  <span className="cart-line-unit-price">${product.price.toFixed(2)} each</span>
                  {!available && (
                    <strong className="unavailable-note">
                      {product.stock < 1 ? "Out of stock" : `Only ${product.stock} available; reduce quantity`}
                    </strong>
                  )}

                  <div className="cart-quantity" aria-label={`Quantity for ${product.title}`}>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => void setQuantity(product._id, quantity - 1)}
                    >
                      −
                    </button>
                    <span className="cart-quantity-val">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={!available || quantity >= Math.min(product.stock, 99)}
                      onClick={() => void setQuantity(product._id, quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="cart-line-end">
                  <strong className="cart-line-total">${lineTotal.toFixed(2)}</strong>
                  <button
                    className="commerce-text-button cart-remove-button"
                    type="button"
                    onClick={() => void removeFromCart(product._id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </section>

          <aside className="cart-summary">
            <h2>Order summary</h2>
            <div className="cart-subtotal-row">
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>
            <p className="cart-shipping-note">Shipping and tax are not configured and are not charged.</p>
            <Link className="commerce-primary-link" href="/checkout">Continue to checkout</Link>
            <Link className="commerce-secondary-link" href="/shop">Continue shopping</Link>
            <button className="commerce-text-button clear-cart-button" type="button" onClick={() => setConfirmClear(true)}>
              Clear cart
            </button>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        danger
        busy={clearing}
        title="Clear your cart?"
        message="All items will be removed from your cart."
        confirmLabel="Clear cart"
        onConfirm={async () => {
          setClearing(true);
          await clearCart();
          setClearing(false);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </main>
  );
}
