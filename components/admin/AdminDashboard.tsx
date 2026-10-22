"use client";

import { useState } from "react";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminOrders from "@/components/admin/AdminOrders";

export default function AdminDashboard() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  return <section>
    <div className="admin-tabs" role="tablist" aria-label="Admin sections">
      <button role="tab" type="button" aria-selected={tab === "products"} className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Products</button>
      <button role="tab" type="button" aria-selected={tab === "orders"} className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Orders</button>
    </div>
    {tab === "products" ? <AdminProducts /> : <AdminOrders />}
  </section>;
}
