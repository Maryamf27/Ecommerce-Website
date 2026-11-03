import type Stripe from "stripe";
import { connectToDatabase } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { applyCheckoutEvent, applyPaymentIntentFailedEvent } from "@/lib/checkout-payments";
import { apiErrorResponse } from "@/lib/api-error";

import { withApiRequestLogging } from "@/lib/api-request-logging";
async function POSTHandler(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return Response.json({ error: "Webhook signature configuration is missing." }, { status: 400 });
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  const relevant = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "payment_intent.payment_failed"]);
  if (!relevant.has(event.type)) return Response.json({ received: true });
  try {
    await connectToDatabase();
    if (event.type === "payment_intent.payment_failed") {
      await applyPaymentIntentFailedEvent({ id: event.id, paymentIntent: event.data.object });
    } else {
      await applyCheckoutEvent({ id: event.id, type: event.type, session: event.data.object as Stripe.Checkout.Session });
    }
    return Response.json({ received: true });
  } catch (error) {
    return apiErrorResponse({ context: "api/stripe/webhook processing", error, payload: { error: "Payment update could not be saved. Stripe may retry this event." }, status: 500, headers: undefined });
  }
}

export const POST = withApiRequestLogging("POST /api/stripe/webhook", POSTHandler);
