"use client";

import Link from "next/link";

/** Replaces the loading UI if the checkout route fails, so a spinner never hangs after an error. */
export default function CheckoutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="commerce-page">
    <section className="commerce-state checkout-result" role="alert">
      <p className="auth-kicker">CHECKOUT</p>
      <h1>Checkout is temporarily unavailable</h1>
      <p>Something went wrong while loading this page. Your cart has not been changed and you have not been charged.</p>
      <button className="retry-button" type="button" onClick={reset}>Try again</button>
      <Link className="commerce-primary-link" href="/cart">Return to cart</Link>
    </section>
  </main>;
}
