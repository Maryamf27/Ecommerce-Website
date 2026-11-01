import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { getCart } from "@/lib/commerce-service";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { checkoutRepository } from "@/repositories/checkout-repository";
import type { CheckoutRequestData } from "@/lib/checkout-validation";

type CheckoutResult =
  | { kind: "success"; url: string }
  | { kind: "cart_changed" }
  | { kind: "price_changed"; data: Awaited<ReturnType<typeof getCart>> }
  | { kind: "unavailable"; message: string; details: Array<{ title: string; requested: number; available: number }> }
  | { kind: "zero_total" }
  | { kind: "not_payable" };

/** Checkout use-case: validates the live cart, snapshots trusted prices, creates the order and Stripe session. */
export async function createCheckoutSession(userId: string, input: CheckoutRequestData): Promise<CheckoutResult> {
  await connectToDatabase();
  const cart = await getCart(userId);
  if (cart.items.length === 0 || cart.items.length !== input.expectedItems.length) return { kind: "cart_changed" };

  const expectedById = new Map(input.expectedItems.map((item) => [item.productId, item] as const));
  const changed = cart.items.some(({ product, quantity }) => {
    const expected = expectedById.get(product._id.toLowerCase());
    return !expected || expected.quantity !== quantity || expected.unitAmount !== Math.round(product.price * 100);
  });
  if (changed) return { kind: "price_changed", data: cart };

  const stockIssues = cart.items
    .filter(({ available }) => !available)
    .map(({ product, quantity }) => ({ title: product.title, requested: quantity, available: product.stock }));
  if (stockIssues.length > 0) {
    return {
      kind: "unavailable",
      message: stockIssues.map((issue) => `${issue.title}: ${issue.available} available, ${issue.requested} requested.`).join(" "),
      details: stockIssues,
    };
  }

  const productRecords = await checkoutRepository.findProductsByIds(cart.items.map(({ product }) => product._id));
  if (productRecords.length !== cart.items.length) return { kind: "cart_changed" };
  const productMap = new Map(productRecords.map((product) => [product._id.toString(), product]));
  const lines = cart.items.map(({ product, quantity }) => {
    const record = productMap.get(product._id);
    if (!record) throw new Error("A cart product could not be loaded.");
    if (!Number.isFinite(record.price) || !Number.isSafeInteger(record.stock) || record.stock < quantity) {
      throw new RangeError(`${record.title}: ${Number.isSafeInteger(record.stock) ? record.stock : 0} available, ${quantity} requested. Update your cart before checkout.`);
    }
    const unitAmount = Math.round(record.price * 100);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 1) throw new RangeError("A product has an invalid price.");
    return { productId: new Types.ObjectId(product._id), title: record.title, image: record.image, quantity, unitAmount };
  });

  const subtotal = lines.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0) return { kind: "zero_total" };

  const order = await checkoutRepository.findOrCreatePendingOrder({
    userId,
    requestKey: input.requestKey,
    items: lines,
    shipping: input.shipping,
    subtotal,
  });
  if (order.paymentStatus !== "pending") return { kind: "not_payable" };

  const stripe = getStripe();
  const baseUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.shipping.email,
    client_reference_id: order._id.toString(),
    metadata: { orderId: order._id.toString(), userId },
    line_items: order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: item.unitAmount,
        product_data: { name: item.title },
      },
    })),
    success_url: new URL(`/checkout/success?session_id={CHECKOUT_SESSION_ID}`, baseUrl).toString(),
    cancel_url: new URL("/checkout/cancel", baseUrl).toString(),
  }, { idempotencyKey: `nexora_order_${order._id.toString()}` });

  if (!session.url || session.livemode) throw new Error("Stripe did not return a valid test-mode Checkout URL.");
  if (order.stripeSessionId && order.stripeSessionId !== session.id) throw new Error("Checkout session reference did not match the order.");
  await checkoutRepository.saveStripeSession(order._id, session.id);
  return { kind: "success", url: session.url };
}
