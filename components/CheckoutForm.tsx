"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import Select from "@/components/Select";
import { useCommerce } from "@/components/CommerceProvider";
import type { PublicUser } from "@/lib/auth";

type Fields = { name: string; email: string; address: string; city: string; postalCode: string; country: string; countryOther: string };
type ErrorPayload = { success?: boolean; error?: { message?: string; fields?: Record<string, string>; code?: string } };
const countries = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"],
  ["NZ", "New Zealand"], ["PK", "Pakistan"], ["IN", "India"], ["AE", "United Arab Emirates"],
  ["DE", "Germany"], ["FR", "France"], ["IT", "Italy"], ["ES", "Spain"], ["NL", "Netherlands"], ["JP", "Japan"],
];

type SavedAddress = { name: string; address: string; city: string; postalCode: string; country: string };

export default function CheckoutForm({ user, savedAddress = null }: { user: PublicUser; savedAddress?: SavedAddress | null }) {
  const { cartItems, loading, loadError, refresh } = useCommerce();
  const savedCode = savedAddress ? countries.find(([, name]) => name.toLowerCase() === savedAddress.country.toLowerCase())?.[0] : undefined;
  const [fields, setFields] = useState<Fields>({
    name: savedAddress?.name ?? user.name, email: user.email, address: savedAddress?.address ?? "", city: savedAddress?.city ?? "", postalCode: savedAddress?.postalCode ?? "",
    country: savedAddress ? (savedCode ?? "OTHER") : "US", countryOther: savedAddress && !savedCode ? savedAddress.country : "",
  });
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const submitting = useRef(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const unavailable = cartItems.some((item) => !item.available);

  // Returning from Stripe via the browser's back button can restore this page with the button stuck in "busy".
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { submitting.current = false; setBusy(false); } };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setMessage("");
    setSessionExpired(false);
    if (cartItems.length === 0 || unavailable) { setMessage("Your cart is empty or contains unavailable items. Return to the cart to review it."); return; }
    if (fields.country === "OTHER" && fields.countryOther.trim().length < 2) { setErrors((current) => ({ ...current, countryOther: "Enter your country." })); return; }
    submitting.current = true;
    setBusy(true);
    let redirecting = false;
    try {
      const country = fields.country === "OTHER" ? fields.countryOther.trim() : countries.find(([code]) => code === fields.country)?.[1] ?? "";
      const response = await fetch("/api/checkout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, country, requestKey, expectedItems: cartItems.map(({ product, quantity }) => ({ productId: product._id, quantity, unitAmount: Math.round(product.price * 100) })) }) });
      const payload = await response.json() as ErrorPayload & { data?: { url?: string } };
      if (!response.ok || !payload.success || !payload.data?.url) {
        if (response.status === 401) { setSessionExpired(true); setMessage("Your session has expired. Sign in again to continue to checkout."); return; }
        if (payload.error?.fields) setErrors(payload.error.fields);
        if (payload.error?.code === "price_changed" || payload.error?.code === "cart_changed") { await refresh(); setRequestKey(crypto.randomUUID()); }
        setMessage(payload.error?.message ?? "Secure checkout could not be started.");
        return;
      }
      if (saveAddress) {
        // Best effort: a failure here must never block payment.
        await fetch("/api/account/address", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fields.name, address: fields.address, city: fields.city, postalCode: fields.postalCode, country }) }).catch(() => undefined);
      }
      // Stay busy until the browser leaves for Stripe so the order cannot be submitted twice.
      redirecting = true;
      window.location.assign(payload.data.url);
    } catch { setMessage("Secure checkout could not be started. Check your connection and try again."); }
    finally { if (!redirecting) { submitting.current = false; setBusy(false); } }
  }

  const field = (name: keyof Fields, label: string, type = "text", autoComplete?: string) => <div className="auth-field" key={name}>
    <label htmlFor={`checkout-${name}`}>{label}</label>
    <input id={`checkout-${name}`} name={name} type={type} autoComplete={autoComplete} value={fields[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `checkout-${name}-error` : undefined} required />
    {errors[name] && <p className="auth-field-error" id={`checkout-${name}-error`}>{errors[name]}</p>}
  </div>;

  return <main className="commerce-page checkout-page">
    <div className="commerce-page-heading"><p className="auth-kicker">SECURE CHECKOUT</p><h1>Delivery details</h1><p>Review your items and enter where to send your order.</p></div>
    {loading ? <p className="commerce-state" role="status" aria-busy="true">Loading your cart…</p> : cartItems.length === 0 && loadError ? <section className="commerce-state" role="alert"><h2>We couldn&apos;t load your cart</h2><p>This is usually temporary. Your saved items have not been removed.</p><button className="retry-button" type="button" onClick={() => { void refresh(); }}>Try again</button></section> : cartItems.length === 0 ? <section className="commerce-state"><h2>Your cart is empty</h2><p>Add available products before starting checkout.</p><Link className="commerce-primary-link" href="/shop">Browse products</Link></section> : <div className="checkout-layout">
      <form className="auth-card checkout-card" onSubmit={submit} noValidate>
        <h2>Shipping information</h2>
        <div className="checkout-fields">{field("name", "Full name", "text", "name")}{field("email", "Email address", "email", "email")}{field("address", "Street address", "street-address")}{field("city", "City", "text", "address-level2")}{field("postalCode", "Postal code", "text", "postal-code")}
          <div className="auth-field"><label htmlFor="checkout-country">Country</label><Select id="checkout-country" placeholder="Select your country" value={fields.country} onChange={(next) => update("country", next)} invalid={Boolean(errors.country)} describedBy={errors.country ? "checkout-country-error" : undefined} options={[...countries.map(([code, name]) => ({ value: code, label: name })), { value: "OTHER", label: "Other country…" }]} />{errors.country && <p className="auth-field-error" id="checkout-country-error">{errors.country}</p>}{fields.country === "OTHER" && <div className="checkout-country-other"><label htmlFor="checkout-country-other">Country name</label><input id="checkout-country-other" name="countryOther" autoComplete="country-name" value={fields.countryOther} onChange={(event) => update("countryOther", event.target.value)} aria-invalid={Boolean(errors.countryOther)} aria-describedby={errors.countryOther ? "checkout-country-other-error" : undefined} required />{errors.countryOther && <p className="auth-field-error" id="checkout-country-other-error">{errors.countryOther}</p>}</div>}</div>
        </div>
        <label className="checkout-save"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} /> Save this address to my account</label>
        <p className="checkout-policy">Shipping and tax are not configured yet, so this checkout adds no shipping fee or tax.</p>
        {message && <p className="commerce-error" role="alert">{message}{sessionExpired && <> <Link href="/login?next=%2Fcheckout">Sign in</Link></>}</p>}
        {busy && <p className="checkout-policy" role="status">Preparing your secure payment page. Please don&apos;t close this window.</p>}
        <button className="primary-button checkout-submit" type="submit" disabled={busy || loading || unavailable} aria-busy={busy}>{busy ? "Connecting to Stripe…" : "Continue to secure payment"}</button>
        {unavailable && <p className="auth-field-error">One or more items have no recorded stock or the quantity is above recorded stock. Return to your cart to review it.</p>}
        <Link className="commerce-text-button checkout-back" href="/cart">Return to cart to adjust quantities</Link>
      </form>
      <aside className="cart-summary checkout-summary"><h2>Order summary</h2><div className="checkout-summary-lines">{cartItems.map(({ product, quantity, lineTotal }) => <article className="checkout-summary-item" key={product._id}><span className="checkout-summary-image"><ProductImage src={product.image} alt={product.title} sizes="60px" /></span><div><strong>{product.title}</strong><span>Qty {quantity} · ${product.price.toFixed(2)} each</span></div><b>${lineTotal.toFixed(2)}</b></article>)}</div><div><span>Product subtotal</span><strong>${subtotal.toFixed(2)}</strong></div><p>Final amount due: <strong>${subtotal.toFixed(2)}</strong>. Payment is processed by Stripe Checkout.</p></aside>
    </div>}
  </main>;
}
