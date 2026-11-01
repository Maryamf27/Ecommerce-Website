import { reconcileCheckoutSession } from "@/lib/checkout-payments";
import { logServerError } from "@/lib/server-logging";
import { serializeOrder } from "@/lib/orders";
import { orderRepository } from "@/repositories/order-repository";

export async function getCustomerOrderBySession(userId: string, sessionId: string) {
  let order = await orderRepository.findByUserAndStripeSession(userId, sessionId);
  if (order?.paymentStatus === "pending") {
    // The webhook is the primary update path; reconcile with Stripe as a fallback.
    try {
      await reconcileCheckoutSession(sessionId);
      order = await orderRepository.findByUserAndStripeSession(userId, sessionId);
    } catch (error) {
      logServerError("orders reconcile", error);
    }
  }
  return order;
}

export async function listAdminOrders() {
  const orders = await orderRepository.findAdminOrders();
  const userIds = Array.from(new Set(orders.map((order) => order.userId.toString())));
  const users = await orderRepository.findUsersByIds(userIds);
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  return orders.map((order) => ({
    ...serializeOrder(order),
    customer: {
      name: usersById.get(order.userId.toString())?.name ?? "Unknown",
      email: usersById.get(order.userId.toString())?.email ?? "",
    },
  }));
}

export async function updateAdminOrderStatus(id: string, status: string) {
  return orderRepository.updateFulfilmentStatus(id, status);
}
