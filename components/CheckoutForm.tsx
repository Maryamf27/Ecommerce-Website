"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useCommerce } from "@/components/CommerceProvider";
import type { PublicUser } from "@/lib/auth";

type Fields = { name: string; email: string; address: string; city: string; postalCode: string; country: string; countryOther: string };
type ErrorPayload = { success?: boolean; error?: { message?: string; fields?: Record<string, string>; code?: string } };
const countries = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["PK", "Pakistan"], ["IN", "India"], ["AE", "United Arab Emirates"],
  ["DE", "Germany"], ["FR", "France"], ["IT", "Italy"], ["ES", "Spain"], ["NL", "Netherlands"], ["JP", "Japan"],
];

export default function CheckoutForm({ user }: { user: PublicUser }) {
  const { cartItems, loading, refresh } = useCommerce();
  const [fields, setFields] = useState<Fields>({ name: user.name, email: user.email, address: "", city: "", postalCode: "", country: "US", countryOther: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const unavailable = cartItems.some((item) => !item.available);

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (cartItems.length === 0 || unavailable) { setMessage("Your cart is empty or contains unavailable items. Return to the cart to review it."); return; }
    if (fields.country === "OTHER" && fields.countryOther.trim().length < 2) { setErrors((current) => ({ ...current, countryOther: "Enter your country." })); return; }
    setBusy(true);
    try {
      const country = fields.country === "OTHER" ? fields.countryOther.trim() : countries.find(([code]) => code === fields.country)?.[1] ?? "";
      const response = await fetch("/api/checkout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, country, requestKey, expectedItems: cartItems.map(({ product, quantity }) => ({ productId: product._id, quantity, unitAmount: Math.round(product.price * 100) })) }) });
      const payload = await response.json() as ErrorPayload & { data?: { url?: string } };
      if (!response.ok || !payload.success || !payload.data?.url) {
        if (payload.error?.fields) setErrors(payload.error.fields);
        if (payload.error?.code === "price_changed" || payload.error?.code === "cart_changed") { await refresh(); setRequestKey(crypto.randomUUID()); }
        setMessage(payload.error?.message ?? "Secure checkout could not be started.");
        return;
      }
      window.location.assign(payload.data.url);
    } catch { setMessage("Secure checkout could not be started. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  const field = (name: keyof Fields, label: string, type = "text", autoComplete?: string) => <div className="auth-field" key={name}>
    <label htmlFor={`checkout-${name}`}>{label}</label>
    <input id={`checkout-${name}`} name={name} type={type} autoComplete={autoComplete} value={fields[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `checkout-${name}-error` : undefined} required />
    {errors[name] && <p className="auth-field-error" id={`checkout-${name}-error`}>{errors[name]}</p>}
  </div>;

  return <main className="commerce-page checkout-page">
    <div className="commerce-page-heading"><p className="auth-kicker">SECURE CHECKOUT</p><h1>Delivery details</h1><p>Review your items and enter where to send your order.</p></div>
    {loading ? <p className="commerce-state" role="status">Loading your cart…</p> : cartItems.length === 0 ? <section className="commerce-state"><h2>Your cart is empty</h2><p>Add available products before starting checkout.</p><Link className="commerce-primary-link" href="/shop">Browse products</Link></section> : <div className="checkout-layout">
      <form className="auth-card checkout-card" onSubmit={submit} noValidate>
        <h2>Shipping information</h2>
        <div className="checkout-fields">{field("name", "Full name", "text", "name")}{field("email", "Email address", "email", "email")}{field("address", "Street address", "street-address")}{field("city", "City", "text", "address-level2")}{field("postalCode", "Postal code", "text", "postal-code")}
          <div className="auth-field"><label htmlFor="checkout-country">Country</label><select id="checkout-country" name="country" value={fields.country} onChange={(event) => update("country", event.target.value)} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "checkout-country-error" : undefined} required><option value="" disabled>Select your country</option>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}<option value="OTHER">Other country…</option></select>{errors.country && <p className="auth-field-error" id="checkout-country-error">{errors.country}</p>}{fields.country === "OTHER" && <div className="checkout-country-other"><label htmlFor="checkout-country-other">Country name</label><input id="checkout-country-other" name="countryOther" autoComplete="country-name" value={fields.countryOther} onChange={(event) => update("countryOther", event.target.value)} aria-invalid={Boolean(errors.countryOther)} aria-describedby={errors.countryOther ? "checkout-country-other-error" : undefined} required />{errors.countryOther && <p className="auth-field-error" id="checkout-country-other-error">{errors.countryOther}</p>}</div>}</div>
        </div>
        <p className="checkout-policy">Shipping and tax are not configured yet, so this checkout adds no shipping fee or tax.</p>
        {message && <p className="commerce-error" role="alert">{message}</p>}
        <button className="primary-button checkout-submit" type="submit" disabled={busy || loading || unavailable}>{busy ? "Connecting to Stripe…" : "Continue to secure payment"}</button>
        {unavailable && <p className="auth-field-error">One or more items have no recorded stock or the quantity is above recorded stock. Return to your cart to review it.</p>}
        <Link className="commerce-text-button checkout-back" href="/cart">Return to cart to adjust quantities</Link>
      </form>
      <aside className="cart-summary checkout-summary"><h2>Order summary</h2><div className="checkout-summary-lines">{cartItems.map(({ product, quantity, lineTotal }) => <article className="checkout-summary-item" key={product._id}><span className="checkout-summary-image"><ProductImage src={product.image} alt={product.title} sizes="60px" /></span><div><strong>{product.title}</strong><span>Qty {quantity} · ${product.price.toFixed(2)} each</span></div><b>${lineTotal.toFixed(2)}</b></article>)}</div><div><span>Product subtotal</span><strong>${subtotal.toFixed(2)}</strong></div><p>Final amount due: <strong>${subtotal.toFixed(2)}</strong>. Payment is processed by Stripe Checkout.</p></aside>
    </div>}
  </main>;
}
