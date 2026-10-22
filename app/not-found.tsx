import Link from "next/link";
import StoreHeader from "@/components/StoreHeader";

export default function NotFound() {
  return <><StoreHeader /><main className="not-found-shell"><section className="commerce-state"><p className="auth-kicker">404</p><h1>Page not found</h1><p>The page you are looking for does not exist or has moved.</p><Link className="commerce-primary-link" href="/shop">Continue shopping</Link></section></main></>;
}
