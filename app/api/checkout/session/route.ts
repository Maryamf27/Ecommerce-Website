import { Types } from "mongoose";
import { findSessionUser, getRequestSessionToken, requestHasValidOrigin } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getCart } from "@/lib/commerce-service";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { logServerError } from "@/lib/server-logging";
import Order from "@/models/Order";
import Product from "@/models/Product";

const noStore = { "Cache-Control": "no-store" };
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, max) : "";

export async function POST(request: Request) {
  // Payment sessions are created from the storefront only; reject cross-site requests like every other state-changing route.
  if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
  let user;
  try { user = await findSessionUser(getRequestSessionToken(request)); }
  catch (error) {
    logServerError("api/checkout/session auth", error);
    return Response.json({ success: false, error: { message: "Your account is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
  if (!user) return Response.json({ success: false, error: { message: "Sign in to continue to checkout." } }, { status: 401, headers: noStore });
  if (user.role === "admin") return Response.json({ success: false, error: { message: "Administrator accounts cannot place orders." } }, { status: 403, headers: noStore });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ success: false, error: { message: "Checkout details are invalid." } }, { status: 400, headers: noStore });
  const data = body as Record<string, unknown>;
  const requestKey = clean(data.requestKey, 64);
  const shipping = {
    name: clean(data.name, 80), email: clean(data.email, 254).toLowerCase(), address: clean(data.address, 180),
    city: clean(data.city, 100), postalCode: clean(data.postalCode, 20), country: clean(data.country, 80),
  };
  const fieldErrors: Record<string, string> = {};
  if (!/^[\w-]{16,64}$/.test(requestKey)) fieldErrors.requestKey = "Refresh checkout and try again.";
  if (shipping.name.length < 2) fieldErrors.name = "Enter your full name.";
  if (shipping.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) fieldErrors.email = "Enter a valid email address.";
  if (shipping.address.length < 5) fieldErrors.address = "Enter a complete street address.";
  if (shipping.city.length < 2) fieldErrors.city = "Enter your city.";
  if (!/^[\p{L}\p{N} -]{2,20}$/u.test(shipping.postalCode)) fieldErrors.postalCode = "Enter a valid postal code.";
  if (shipping.country.length < 2) fieldErrors.country = "Enter your country.";
  const expected = Array.isArray(data.expectedItems) ? data.expectedItems : null;
  if (!expected || expected.length > 100 || expected.some((item) => !item || typeof item !== "object" || !("productId" in item) || typeof item.productId !== "string" || !Types.ObjectId.isValid(item.productId) || !("quantity" in item) || !Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99 || !("unitAmount" in item) || !Number.isSafeInteger(item.unitAmount) || (item.unitAmount as number) < 0)) fieldErrors.expectedItems = "Your cart details are invalid.";
  if (Object.keys(fieldErrors).length) return Response.json({ success: false, error: { message: "Check the highlighted checkout details.", fields: fieldErrors } }, { status: 400, headers: noStore });

  try {
    await connectToDatabase();
    const cart = await getCart(user.id);
    if (cart.items.length === 0 || cart.items.length !== expected!.length) return Response.json({ success: false, error: { code: "cart_changed", message: "Your cart changed. Review it before paying." } }, { status: 409, headers: noStore });
    const expectedById = new Map(expected!.map((entry) => {
      const item = entry as { productId: string; quantity: number; unitAmount: number };
      return [item.productId.toLowerCase(), item];
    }));
    const changed = cart.items.some(({ product, quantity }) => {
      const before = expectedById.get(product._id.toLowerCase());
      return !before || before.quantity !== quantity || before.unitAmount !== Math.round(product.price * 100);
    });
    if (changed) return Response.json({ success: false, error: { code: "price_changed", message: "Product prices or quantities changed. Review the updated cart and confirm again.", data: cart } }, { status: 409, headers: noStore });
    const stockIssues = cart.items.filter(({ available }) => !available).map(({ product, quantity }) => ({ title: product.title, requested: quantity, available: product.stock }));
    if (stockIssues.length > 0) return Response.json({ success: false, error: { code: "unavailable", message: stockIssues.map((issue) => `${issue.title}: ${issue.available} available, ${issue.requested} requested.`).join(" "), details: stockIssues } }, { status: 409, headers: noStore });

    const productRecords = await Product.find({ _id: { $in: cart.items.map(({ product }) => new Types.ObjectId(product._id)) } }).lean();
    if (productRecords.length !== cart.items.length) return Response.json({ success: false, error: { code: "cart_changed", message: "One or more products are no longer available." } }, { status: 409, headers: noStore });
    const productMap = new Map(productRecords.map((product) => [product._id.toString(), product]));
    const lines = cart.items.map(({ product, quantity }) => {
      const record = productMap.get(product._id)!;
      if (!Number.isFinite(record.price) || !Number.isSafeInteger(record.stock) || record.stock < quantity) throw new RangeError(`${record.title}: ${Number.isSafeInteger(record.stock) ? record.stock : 0} available, ${quantity} requested. Update your cart before checkout.`);
      const unitAmount = Math.round(record.price * 100);
      if (!Number.isSafeInteger(unitAmount) || unitAmount < 0) throw new RangeError("A product has an invalid price.");
      return { productId: new Types.ObjectId(product._id), title: record.title, image: record.image, quantity, unitAmount };
    });
    const subtotal = lines.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) return Response.json({ success: false, error: { message: "The cart total must be greater than zero." } }, { status: 400, headers: noStore });
    const order = await Order.findOneAndUpdate(
      { userId: user.id, requestKey },
      { $setOnInsert: { userId: user.id, requestKey, items: lines, shipping, subtotal, shippingAmount: 0, taxAmount: 0, total: subtotal, currency: "usd", paymentStatus: "pending", status: "pending" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (order.paymentStatus !== "pending") return Response.json({ success: false, error: { message: "This checkout attempt can no longer be paid. Start a new checkout." } }, { status: 409, headers: noStore });

    const stripe = getStripe();
    const baseUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: shipping.email,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString(), userId: user.id },
      line_items: order.items.map((item) => ({ quantity: item.quantity, price_data: { currency: "usd", unit_amount: item.unitAmount, product_data: { name: item.title } } })),
      success_url: new URL(`/checkout/success?session_id={CHECKOUT_SESSION_ID}`, baseUrl).toString(),
      cancel_url: new URL("/checkout/cancel", baseUrl).toString(),
    }, { idempotencyKey: `nexora_order_${order._id.toString()}` });
    if (!session.url || session.livemode) throw new Error("Stripe did not return a valid test-mode Checkout URL.");
    if (order.stripeSessionId && order.stripeSessionId !== session.id) throw new Error("Checkout session reference did not match the order.");
    await Order.updateOne({ _id: order._id, $or: [{ stripeSessionId: { $exists: false } }, { stripeSessionId: session.id }] }, { $set: { stripeSessionId: session.id } });
    return Response.json({ success: true, data: { url: session.url } }, { headers: noStore });
  } catch (error) {
    if (error instanceof RangeError) return Response.json({ success: false, error: { message: error.message } }, { status: 409, headers: noStore });
    logServerError("api/checkout/session POST", error);
    return Response.json({ success: false, error: { message: "Secure checkout is temporarily unavailable. Please try again." } }, { status: 503, headers: noStore });
  }
}
