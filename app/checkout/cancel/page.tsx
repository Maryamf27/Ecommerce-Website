import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import Link from "next/link";

export const metadata: Metadata = { title: "Checkout cancelled | Nexora", robots: { index: false, follow: false } };

export default function CheckoutCancelPage() {
  return <><StoreHeader /><main className="commerce-page"><section className="commerce-state checkout-result"><p className="auth-kicker">CHECKOUT CANCELLED</p><h1>Your cart is still here</h1><p>No payment was confirmed. Your items remain in your cart.</p><Link className="commerce-primary-link" href="/cart">Return to cart</Link></section></main></>;
}
