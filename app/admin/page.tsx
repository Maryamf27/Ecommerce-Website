import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getLowStockThreshold } from "@/lib/inventory";
import { logServerError } from "@/lib/server-logging";
import Order from "@/models/Order";
import Product from "@/models/Product";

export const metadata: Metadata = { title: "Admin | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function AdminPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Fadmin");
  if (user.role !== "admin") {
    return <><StoreHeader /><main className="account-shell"><section className="commerce-state"><h1>Administrator access required</h1><p>Your account does not have permission to manage the store.</p><Link className="commerce-primary-link" href="/account">Back to account</Link></section></main></>;
  }

  let stats = { products: 0, outOfStock: 0, lowStock: 0, paidOrders: 0, revenue: 0, toFulfil: 0 };
  try {
    await connectToDatabase();
    const threshold = getLowStockThreshold();
    const [products, outOfStock, lowStock, revenue, toFulfil] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ $or: [{ stock: { $lt: 1 } }, { stock: { $exists: false } }] }),
      Product.countDocuments({ stock: { $gte: 1, $lte: threshold } }),
      Order.aggregate<{ _id: null; total: number; count: number }>([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
      Order.countDocuments({ paymentStatus: "paid", status: "processing" }),
    ]);
    stats = { products, outOfStock, lowStock, paidOrders: revenue[0]?.count ?? 0, revenue: (revenue[0]?.total ?? 0) / 100, toFulfil };
  } catch (error) { logServerError("admin page stats", error); }

  return <><AdminHeader /><main className="admin-shell">
    <p className="auth-kicker">NEXORA ADMIN</p>
    <h1>Store dashboard</h1>
    <p className="account-intro">Add products, manage stock and fulfil orders.</p>
    <section className="admin-stats" aria-label="Store summary">
      <div><span>Products</span><strong>{stats.products}</strong></div>
      <div className={stats.outOfStock ? "attention" : ""}><span>Out of stock</span><strong>{stats.outOfStock}</strong></div>
      <div><span>Low stock</span><strong>{stats.lowStock}</strong></div>
      <div><span>Paid orders</span><strong>{stats.paidOrders}</strong></div>
      <div className={stats.toFulfil ? "attention" : ""}><span>To ship</span><strong>{stats.toFulfil}</strong></div>
      <div><span>Revenue (test)</span><strong>${stats.revenue.toFixed(2)}</strong></div>
    </section>
    <AdminDashboard />
  </main></>;
}
