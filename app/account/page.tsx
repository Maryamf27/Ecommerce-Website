import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Heart, Package, ShieldCheck, ShoppingBag } from "lucide-react";
import StoreHeader from "@/components/StoreHeader";
import AccountLogoutButton from "@/components/AccountLogoutButton";
import OrderCard from "@/components/OrderCard";
import { SavedAddressForm, ChangePasswordForm } from "@/components/AccountForms";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { listUserOrders, type OrderDTO } from "@/lib/orders";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

export const metadata: Metadata = { title: "Your account | Nexora", robots: { index: false, follow: false } };
export const instant = false;

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login?next=%2Faccount");

  const isAdmin = user.role === "admin";
  let orders: OrderDTO[] = [];
  let address: { name: string; address: string; city: string; postalCode: string; country: string } | null = null;
  let loadFailed = false;
  try {
    if (!isAdmin) orders = await listUserOrders(user.id);
    await connectToDatabase();
    const record = await User.findById(user.id).select("savedAddress").lean<{ savedAddress?: { name: string; address: string; city: string; postalCode: string; country: string } } | null>();
    address = record?.savedAddress ? { name: record.savedAddress.name, address: record.savedAddress.address, city: record.savedAddress.city, postalCode: record.savedAddress.postalCode, country: record.savedAddress.country } : null;
  } catch (error) { logServerError("account page", error); loadFailed = true; }

  const paid = orders.filter((order) => order.paymentStatus === "paid");
  const spent = paid.reduce((sum, order) => sum + order.total, 0);
  const inTransit = paid.filter((order) => order.status === "processing" || order.status === "shipped").length;

  return <><StoreHeader/><main className="account-shell">
    <p className="auth-kicker">NEXORA ACCOUNT</p>
    <h1>Welcome back, {user.name.split(/\s+/)[0]}</h1>
    <p className="account-intro">{isAdmin ? "Manage your administrator profile and security." : "Manage your orders, delivery details and security."}</p>

    <section className="account-card" aria-label="Profile information">
      <div className="account-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</div>
      <div className="account-details"><div><span>Name</span><p>{user.name}</p></div><div><span>Email address</span><p>{user.email}</p></div>{user.role === "admin" && <div><span>Role</span><p>Administrator</p></div>}</div>
      <AccountLogoutButton/>
    </section>

    {!isAdmin && <section className="account-stats" aria-label="Order summary">
      <div><span>Orders placed</span><strong>{paid.length}</strong></div>
      <div><span>In progress</span><strong>{inTransit}</strong></div>
      <div><span>Total spent</span><strong>${spent.toFixed(2)}</strong></div>
    </section>}

    <nav className="account-links" aria-label="Account shortcuts">
      {isAdmin ? <Link href="/admin"><ShieldCheck size={17} aria-hidden="true"/>Admin dashboard</Link> : <>
        <Link href="/orders"><Package size={17} aria-hidden="true"/>My orders</Link>
        <Link href="/wishlist"><Heart size={17} aria-hidden="true"/>Wishlist</Link>
        <Link href="/cart"><ShoppingBag size={17} aria-hidden="true"/>Cart</Link>
      </>}
    </nav>

    {!isAdmin && <section className="account-section" aria-labelledby="recent-orders">
      <div className="account-section-head"><h2 id="recent-orders">Recent orders</h2>{orders.length > 3 && <Link className="text-link" href="/orders">View all</Link>}</div>
      {loadFailed ? <p className="commerce-error" role="alert">Some account details could not be loaded. Refresh in a moment.</p>
        : orders.length === 0 ? <p className="account-empty">You have not placed any orders yet. <Link href="/shop">Browse the shop</Link></p>
        : <div className="order-list">{orders.slice(0, 3).map((order) => <OrderCard key={order.id} order={order} />)}</div>}
    </section>}

    <div className="account-panels">
      {!isAdmin && <SavedAddressForm initial={address} defaultName={user.name} />}
      <ChangePasswordForm />
    </div>
  </main></>;
}
