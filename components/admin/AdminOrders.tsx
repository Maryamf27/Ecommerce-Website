"use client";

import { useCallback, useEffect, useState } from "react";
import { orderStatusLabel } from "@/lib/order-labels";
import type { OrderDTO } from "@/lib/orders";

type AdminOrder = OrderDTO & { customer: { name: string; email: string } };
const FLOW = ["processing", "shipped", "delivered"];

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const result = await response.json() as { success?: boolean; data?: AdminOrder[]; error?: { message?: string } };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? "Orders could not be loaded.");
      setOrders(result.data); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Orders could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function changeStatus(order: AdminOrder, status: string) {
    setSavingId(order.id); setError("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json() as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Order could not be updated.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: status as AdminOrder["status"] } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Order could not be updated."); }
    finally { setSavingId(""); }
  }

  return <div className="admin-orders">
    <div className="admin-list-head"><h2>Orders <small>({orders.length})</small></h2><button className="retry-button" type="button" onClick={() => void load()}>Refresh</button></div>
    {error && <p className="auth-message" role="alert">{error}</p>}
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>
          {loading && orders.length === 0 && <tr><td colSpan={6} className="admin-empty">Loading orders…</td></tr>}
          {!loading && orders.length === 0 && <tr><td colSpan={6} className="admin-empty">No orders yet.</td></tr>}
          {orders.map((order) => {
            const editable = order.paymentStatus === "paid" && FLOW.includes(order.status);
            return <tr key={order.id}>
              <td><strong>#{order.id.slice(-8).toUpperCase()}</strong><br /><small>{new Date(order.createdAt).toLocaleString()}</small></td>
              <td>{order.customer.name}<br /><small>{order.customer.email}</small></td>
              <td>{order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}<br /><small>{order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}</small></td>
              <td>${order.total.toFixed(2)}</td>
              <td>{order.paymentStatus}</td>
              <td>{editable
                ? <select className="admin-status-select" value={order.status} disabled={savingId === order.id} onChange={(event) => void changeStatus(order, event.target.value)} aria-label={`Status for order ${order.id.slice(-8)}`}>{FLOW.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select>
                : <span className="status-badge tone-warn">{orderStatusLabel(order)}</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <p className="admin-note">Refunds and cancellations are done in the Stripe dashboard (test mode); they do not restock items automatically.</p>
  </div>;
}
