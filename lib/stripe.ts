import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  if (!secret.startsWith("sk_test_")) throw new Error("Stripe test mode requires a test secret key (sk_test_).");
  return stripeClient ??= new Stripe(secret);
}

export function getAppUrl(): URL {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a secure origin (HTTPS in production).");
  }
  return url;
}
