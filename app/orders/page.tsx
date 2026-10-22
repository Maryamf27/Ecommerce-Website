import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import OrderCard from "@/components/OrderCard";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { listUserOrders, type OrderDTO } from "@/lib/orders";
import { logServerError } from "@/lib/server-logging";

export const metadata: Metadata = { title: "My orders | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Forders");

  let orders: OrderDTO[] = [];
  let failed = false;
  try { orders = await listUserOrders(user.id); } catch (error) { logServerError("orders page", error); failed = true; }

  return <><StoreHeader />
    <main className="account-shell">
      <p className="auth-kicker">NEXORA ACCOUNT</p>
      <h1>My orders</h1>
      <p className="account-intro">Track your purchases and see what is on its way.</p>
      {failed ? <p className="commerce-error" role="alert">Your orders could not be loaded right now. Please refresh in a moment.</p>
        : orders.length === 0 ? <section className="commerce-state"><h2>No orders yet</h2><p>When you place an order it will appear here.</p><Link className="commerce-primary-link" href="/shop">Start shopping</Link></section>
        : <div className="order-list">{orders.map((order, index) => <OrderCard key={order.id} order={order} defaultOpen={index === 0} />)}</div>}
      <p className="account-back"><Link href="/account">← Back to account</Link></p>
    </main></>;
}
