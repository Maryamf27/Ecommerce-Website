import type { Metadata } from "next";
import StoreHeader from "@/components/StoreHeader";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account | Nexora", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <><StoreHeader/><AuthForm mode="register" returnTo="/account"/></>;
}
