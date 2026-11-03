import mongoose from "mongoose";
import type Stripe from "stripe";
import { connectToDatabase } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import Cart from "@/models/Cart";
import Order from "@/models/Order";
import Product from "@/models/Product";
import StripeEvent from "@/models/StripeEvent";

const PAYMENT_FAILURE_MESSAGES: Record<string, string> = {
  card_declined: "Your payment was declined. Try another payment method or contact your bank.",
  insufficient_funds: "Your bank declined the payment for insufficient funds. Try another payment method.",
  expired_card: "This card has expired. Use another payment method.",
  incorrect_cvc: "The card security code could not be verified. Check it or try another payment method.",
  processing_error: "The payment could not be processed. Please try again.",
};
const PAYMENT_FAILURE_CODES = new Set(Object.keys(PAYMENT_FAILURE_MESSAGES));
const GENERIC_PAYMENT_FAILURE_MESSAGE = "Payment could not be completed. Please try again or use another payment method.";

export type PaymentIntentFailure = {
  id: string;
  orderId?: string;
  userId?: string;
  failureCode: string;
  failureMessage: string;
};

export type PaymentIntentFailureOutcome = "updated" | "paid" | "unmatched" | "invalid" | "duplicate";

export function getPaymentIntentFailure(intent: unknown): PaymentIntentFailure | null {
  if (typeof intent !== "object" || intent === null) return null;
  const paymentIntent = intent as Partial<Stripe.PaymentIntent>;
  if (paymentIntent.object !== "payment_intent" || !paymentIntent.id || !/^pi_[A-Za-z0-9]+$/.test(paymentIntent.id) || paymentIntent.livemode !== false) {
    return null;
  }

  const failureCode = [
    paymentIntent.last_payment_error?.decline_code,
    paymentIntent.last_payment_error?.code,
  ].find((code): code is string => Boolean(code && PAYMENT_FAILURE_CODES.has(code)))
    ?? "payment_failed";
  const orderId = paymentIntent.metadata?.orderId;
  const userId = paymentIntent.metadata?.userId;
  return {
    id: paymentIntent.id,
    ...(orderId && /^[a-f\d]{24}$/i.test(orderId) ? { orderId } : {}),
    ...(userId && /^[a-f\d]{24}$/i.test(userId) ? { userId } : {}),
    failureCode,
    failureMessage: PAYMENT_FAILURE_MESSAGES[failureCode] ?? GENERIC_PAYMENT_FAILURE_MESSAGE,
  };
}

async function persistPaymentIntentFailure(
  eventId: string,
  failure: PaymentIntentFailure | null,
): Promise<PaymentIntentFailureOutcome> {
  const dbSession = await mongoose.startSession();
  try {
    return await dbSession.withTransaction(async (): Promise<PaymentIntentFailureOutcome> => {
      if (await StripeEvent.exists({ eventId }).session(dbSession)) return "duplicate";

      let outcome: PaymentIntentFailureOutcome = "invalid";
      if (failure) {
        const orderConditions: Array<Record<string, unknown>> = [
          { stripePaymentIntentId: failure.id },
        ];
        if (failure.orderId) {
          orderConditions.push({
            _id: failure.orderId,
            ...(failure.userId ? { userId: failure.userId } : {}),
            $or: [
              { stripePaymentIntentId: { $exists: false } },
              { stripePaymentIntentId: null },
              { stripePaymentIntentId: failure.id },
            ],
          });
        }
        const order = await Order.findOne({ $or: orderConditions }).session(dbSession);
        if (!order) {
          outcome = "unmatched";
        } else if (order.paymentStatus === "paid") {
          outcome = "paid";
        } else {
          order.paymentStatus = "failed";
          order.stripePaymentIntentId = failure.id;
          order.paymentFailureCode = failure.failureCode;
          order.paymentFailureMessage = failure.failureMessage;
          await order.save({ session: dbSession });
          outcome = "updated";
        }
      }

      await StripeEvent.create([{ eventId, type: "payment_intent.payment_failed" }], { session: dbSession });
      return outcome;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return "duplicate";
    }
    throw error;
  } finally {
    await dbSession.endSession();
  }
}

export async function applyPaymentIntentFailedEvent(
  event: { id: string; paymentIntent: unknown },
  persist: typeof persistPaymentIntentFailure = persistPaymentIntentFailure,
): Promise<PaymentIntentFailureOutcome> {
  const failure = getPaymentIntentFailure(event.paymentIntent);
  const outcome = await persist(event.id, failure);
  if (outcome === "unmatched" || outcome === "invalid") {
    console.warn(JSON.stringify({
      level: "warn",
      event: "stripe_payment_intent_failure_not_applied",
      stripeEventId: event.id,
      reason: outcome,
    }));
  }
  return outcome;
}

class InventoryUnavailableAfterPayment extends Error {
  constructor(readonly issue: { productId: mongoose.Types.ObjectId; title: string; requested: number; available: number }) {
    super("Payment succeeded after the remaining stock was purchased.");
  }
}

function paymentIntentId(value: Stripe.Checkout.Session["payment_intent"]): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

export async function applyCheckoutEvent(event: { id: string; type: string; session: Stripe.Checkout.Session }) {
  const session = event.session;
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
        const intentId = paymentIntentId(session.payment_intent);
        if (intentId) order.stripePaymentIntentId = intentId;
        order.paymentFailureCode = "payment_failed";
        order.paymentFailureMessage = GENERIC_PAYMENT_FAILURE_MESSAGE;
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

/**
 * Confirms a pending order by asking Stripe directly for the Checkout Session.
 * The webhook is the primary path, but it never reaches a local dev server unless
 * `stripe listen` is running (and can be delayed in production), which left paid
 * test orders stuck on "Awaiting payment". This runs the exact same transactional
 * logic, so it is idempotent with the webhook: whichever runs second is a no-op.
 */
export async function reconcileCheckoutSession(sessionId: string): Promise<void> {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) return;
  await connectToDatabase();
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid") {
    await applyCheckoutEvent({ id: `reconcile_paid_${session.id}`, type: "checkout.session.completed", session });
  } else if (session.status === "expired") {
    await applyCheckoutEvent({ id: `reconcile_expired_${session.id}`, type: "checkout.session.expired", session });
  }
}
