import mongoose from "mongoose";
import type Stripe from "stripe";
import { connectToDatabase } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { logServerError } from "@/lib/server-logging";
import Cart from "@/models/Cart";
import Order from "@/models/Order";
import Product from "@/models/Product";
import StripeEvent from "@/models/StripeEvent";

class InventoryUnavailableAfterPayment extends Error {
  constructor(readonly issue: { productId: mongoose.Types.ObjectId; title: string; requested: number; available: number }) {
    super("Payment succeeded after the remaining stock was purchased.");
  }
}

function paymentIntentId(value: Stripe.Checkout.Session["payment_intent"]): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

async function applyEvent(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.livemode) throw new Error("Live-mode Checkout event received by the test-mode integration.");
  const orderId = session.metadata?.orderId;
  if (!orderId || session.client_reference_id !== orderId || !/^[a-f\d]{24}$/i.test(orderId)) throw new Error("Stripe Checkout event has no valid order reference.");
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      if (await StripeEvent.exists({ eventId: event.id }).session(dbSession)) return;
      const order = await Order.findOne({ _id: orderId, stripeSessionId: session.id, userId: session.metadata?.userId }).session(dbSession);
      if (!order || order.currency !== session.currency || order.total !== session.amount_total) throw new Error("Stripe Checkout event did not match the order record.");

      if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && session.payment_status === "paid") {
        if (order.paymentStatus !== "paid") {
          for (const item of order.items) {
            const result = await Product.updateOne(
              { _id: item.productId, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity }, $set: { stockManaged: true } },
              { session: dbSession },
            );
            if (result.modifiedCount !== 1) {
              const current = await Product.findById(item.productId).select("stock").session(dbSession).lean<{ stock: number } | null>();
              throw new InventoryUnavailableAfterPayment({ productId: item.productId, title: item.title, requested: item.quantity, available: current?.stock ?? 0 });
            }
          }
          order.paymentStatus = "paid";
          order.status = "processing";
          const intentId = paymentIntentId(session.payment_intent);
          if (intentId) order.stripePaymentIntentId = intentId;
          await order.save({ session: dbSession });

          const cart = await Cart.findOne({ userId: order.userId }).session(dbSession);
          if (cart) {
            const purchases = new Map(order.items.map((item) => [item.productId.toString(), item.quantity]));
            cart.items = cart.items.flatMap((line) => {
              const remaining = line.quantity - (purchases.get(line.productId.toString()) ?? 0);
              if (remaining <= 0) return [];
              return [{ productId: line.productId, quantity: remaining }];
            });
            await cart.save({ session: dbSession });
          }
        }
      } else if (event.type === "checkout.session.async_payment_failed" && order.paymentStatus === "pending") {
        order.paymentStatus = "failed";
        await order.save({ session: dbSession });
      } else if (event.type === "checkout.session.expired" && order.paymentStatus === "pending") {
        order.paymentStatus = "expired";
        await order.save({ session: dbSession });
      }
      await StripeEvent.create([{ eventId: event.id, type: event.type }], { session: dbSession });
    });
  } catch (error) {
    if (!(error instanceof InventoryUnavailableAfterPayment)) throw error;
    await dbSession.withTransaction(async () => {
      if (await StripeEvent.exists({ eventId: event.id }).session(dbSession)) return;
      const order = await Order.findOne({ _id: orderId, stripeSessionId: session.id, userId: session.metadata?.userId }).session(dbSession);
      if (!order) throw new Error("Paid Checkout Session did not match an order.");
      if (order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.status = "inventory_issue";
        order.inventoryIssues = [error.issue];
        const intentId = paymentIntentId(session.payment_intent);
        if (intentId) order.stripePaymentIntentId = intentId;
        await order.save({ session: dbSession });
      }
      await StripeEvent.create([{ eventId: event.id, type: event.type }], { session: dbSession });
    });
  } finally { await dbSession.endSession(); }
}

export async function POST(request: Request) {
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
  const relevant = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);
  if (!relevant.has(event.type)) return Response.json({ received: true });
  try {
    await connectToDatabase();
    await applyEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    logServerError("api/stripe/webhook processing", error);
    return Response.json({ error: "Payment update could not be saved. Stripe may retry this event." }, { status: 500 });
  }
}
