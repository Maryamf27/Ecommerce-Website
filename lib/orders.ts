import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import Order, { type OrderDocument } from "@/models/Order";
import { reconcileCheckoutSession } from "@/lib/checkout-payments";
import { logServerError } from "@/lib/server-logging";

export type OrderDTO = {
  id: string;
  createdAt: string;
  paymentStatus: OrderDocument["paymentStatus"];
  status: OrderDocument["status"];
  total: number;
  shipping: OrderDocument["shipping"];
  items: Array<{ productId: string; title: string; image: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

type StoredOrder = OrderDocument & { _id: Types.ObjectId };

export function serializeOrder(order: StoredOrder): OrderDTO {
  return {
    id: order._id.toString(),
    createdAt: order.createdAt.toISOString(),
    paymentStatus: order.paymentStatus,
    status: order.status,
    total: order.total / 100,
    shipping: order.shipping,
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      title: item.title,
      image: item.image,
      quantity: item.quantity,
      unitPrice: item.unitAmount / 100,
      lineTotal: (item.unitAmount * item.quantity) / 100,
    })),
  };
}

export async function listUserOrders(userId: string, limit = 50): Promise<OrderDTO[]> {
  await connectToDatabase();
  const pending = await Order.find({ userId: new Types.ObjectId(userId), paymentStatus: "pending", stripeSessionId: { $exists: true } })
    .sort({ createdAt: -1 }).limit(5).select("stripeSessionId").lean<Array<{ stripeSessionId?: string }>>();
  await Promise.all(pending.map(async ({ stripeSessionId }) => {
    if (!stripeSessionId) return;
    try { await reconcileCheckoutSession(stripeSessionId); } catch (error) { logServerError("orders reconcile", error); }
  }));
  const orders = await Order.find({ userId: new Types.ObjectId(userId), paymentStatus: { $ne: "expired" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<StoredOrder[]>();
  return orders.map(serializeOrder);
}
