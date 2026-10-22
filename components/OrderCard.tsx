import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { orderStatusLabel } from "@/lib/order-labels";
import type { OrderDTO } from "@/lib/orders";

const STEPS = ["processing", "shipped", "delivered"] as const;

function statusTone(order: OrderDTO): string {
  if (order.paymentStatus === "failed" || order.status === "cancelled") return "bad";
  if (order.paymentStatus === "pending" || order.status === "inventory_issue") return "warn";
  if (order.status === "delivered") return "good";
  return "info";
}

export default function OrderCard({ order, defaultOpen = false }: { order: OrderDTO; defaultOpen?: boolean }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const stepIndex = (STEPS as readonly string[]).indexOf(order.status);
  const showTracker = order.paymentStatus === "paid" && stepIndex >= 0;
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return <details className="order-card" open={defaultOpen}>
    <summary>
      <div className="order-card-main">
        <strong>Order #{order.id.slice(-8).toUpperCase()}</strong>
        <span>{date} · {count} {count === 1 ? "item" : "items"}</span>
      </div>
      <span className={`status-badge tone-${statusTone(order)}`}>{orderStatusLabel(order)}</span>
      <b className="order-card-total">${order.total.toFixed(2)}</b>
    </summary>
    <div className="order-card-body">
      {showTracker && <ol className="order-tracker" aria-label="Order progress">
        {STEPS.map((step, index) => <li key={step} className={index <= stepIndex ? "done" : ""}><span aria-hidden="true">{index + 1}</span>{step[0].toUpperCase() + step.slice(1)}</li>)}
      </ol>}
      {order.paymentStatus === "pending" && <p className="order-note">We are still waiting for payment confirmation. If you already paid, this updates in a moment.</p>}
      {order.status === "inventory_issue" && <p className="order-note">Payment was received but stock changed while it was processing. Our team will review this order.</p>}
      <div className="order-items">
        {order.items.map((item, index) => <article key={`${item.productId}-${index}`} className="order-item">
          <span className="order-item-image"><ProductImage src={item.image} alt={item.title} sizes="56px" /></span>
          <div><Link href={`/products/${item.productId}`}>{item.title}</Link><span>Qty {item.quantity} · ${item.unitPrice.toFixed(2)} each</span></div>
          <b>${item.lineTotal.toFixed(2)}</b>
        </article>)}
      </div>
      <p className="order-ship">Ships to {order.shipping.name}, {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}</p>
    </div>
  </details>;
}
