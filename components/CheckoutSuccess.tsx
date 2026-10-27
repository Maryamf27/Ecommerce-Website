"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCommerce } from "@/components/CommerceProvider";

type OrderStatus = { id: string; paymentStatus: "pending" | "paid" | "failed" | "expired"; status: string; total: number; inventoryIssues: Array<{ title: string; requested: number; available: number }>; items: Array<{ title: string; quantity: number; lineTotal: number }> };

export default function CheckoutSuccess({ sessionId }: { sessionId: string }) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [message, setMessage] = useState("Checking your order status…");
  const { refresh } = useCommerce();
  const refreshedCart = useRef(false);
  const validSession = /^cs_test_[A-Za-z0-9_]+$/.test(sessionId);
  useEffect(() => {
    let active = true;
    const poll: { id?: number } = {};
    if (!validSession) return;
    const load = async () => {
      try {
        const response = await fetch(`/api/orders?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const payload = await response.json() as { success?: boolean; data?: OrderStatus; error?: { message?: string } };
        if (!active) return;
        if (!response.ok || !payload.data) { setMessage(payload.error?.message ?? "Your order status is temporarily unavailable."); return; }
        setOrder(payload.data);
        if (payload.data.paymentStatus !== "pending") {
          // The server has now settled the order (and removed the purchased items from the cart): stop polling
          // and reload the cart so the header badge and cart page do not keep showing the old items.
          window.clearInterval(poll.id);
          if (!refreshedCart.current) { refreshedCart.current = true; void refresh(); }
        }
        setMessage(payload.data.paymentStatus === "pending" ? "Payment is being confirmed. This can take a short time." : "");
      } catch { if (active) setMessage("Your order status is temporarily unavailable."); }
    };
    void load();
    poll.id = window.setInterval(() => { void load(); }, 5000);
    return () => { active = false; window.clearInterval(poll.id); };
  }, [sessionId, validSession, refresh]);

  return <main className="commerce-page"><section className="commerce-state checkout-result" aria-live="polite">
    <p className="auth-kicker">NEXORA ORDER</p>
    <h1>{order?.status === "inventory_issue" ? "Payment received — order needs review" : order?.paymentStatus === "paid" ? "Payment confirmed" : order?.paymentStatus === "failed" ? "Payment failed" : order?.paymentStatus === "expired" ? "Checkout expired" : "Thank you"}</h1>
    {!validSession ? <p>This order reference is not valid.</p> : message && <p>{message}</p>}
    {order && <><p>Order reference: <strong>{order.id}</strong></p>{order.paymentStatus === "paid" && <><div className="checkout-result-items">{order.items.map((item, index) => <div key={`${item.title}-${index}`}><span>{item.title} × {item.quantity}</span><strong>${item.lineTotal.toFixed(2)}</strong></div>)}</div><p>Paid total: <strong>${order.total.toFixed(2)}</strong></p>{order.status === "inventory_issue" ? <div className="commerce-error"><p>Stock changed while payment was processing. This order is held for manual review; the cart was kept.</p>{order.inventoryIssues.map((issue, index) => <p key={`${issue.title}-${index}`}>{issue.title}: {issue.available} available, {issue.requested} purchased.</p>)}</div> : <p>Your order is being prepared. Inventory was deducted after payment confirmation.</p>}</>}{order.paymentStatus === "failed" && <p>Your cart was kept. You can return to it and try again.</p>}{order.paymentStatus === "expired" && <p>Your cart was kept. Start a new checkout whenever you are ready.</p>}</>}
    <Link className="commerce-primary-link" href={order?.paymentStatus === "paid" && order.status !== "inventory_issue" ? "/shop" : "/cart"}>{order?.paymentStatus === "paid" && order.status !== "inventory_issue" ? "Continue shopping" : "Return to cart"}</Link>
  </section></main>;
}
