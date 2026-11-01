import { Types } from "mongoose";
import Order, { type OrderDocument } from "@/models/Order";
import User from "@/models/User";

export type StoredOrder = OrderDocument & { _id: Types.ObjectId };

export const orderRepository = {
  async findByUserAndStripeSession(userId: string, stripeSessionId: string) {
    return Order.findOne({ userId: new Types.ObjectId(userId), stripeSessionId }).lean<StoredOrder | null>();
  },

  async findPendingStripeSessions(userId: string) {
    return Order.find({ userId: new Types.ObjectId(userId), paymentStatus: "pending", stripeSessionId: { $exists: true } })
      .sort({ createdAt: -1 }).limit(5).select("stripeSessionId").lean<Array<{ stripeSessionId?: string }>>();
  },

  async findCustomerOrders(userId: string, limit = 50) {
    return Order.find({ userId: new Types.ObjectId(userId), paymentStatus: { $ne: "expired" } })
      .sort({ createdAt: -1 }).limit(limit).lean<StoredOrder[]>();
  },

  async findAdminOrders(limit = 100) {
    return Order.find({ paymentStatus: { $ne: "expired" } }).sort({ createdAt: -1 }).limit(limit).lean<StoredOrder[]>();
  },

  async findUsersByIds(ids: string[]) {
    return User.find({ _id: { $in: ids } }).select("name email")
      .lean<Array<{ _id: Types.ObjectId; name: string; email: string }>>();
  },

  async updateFulfilmentStatus(id: string, status: string) {
    return Order.updateOne(
      { _id: id, paymentStatus: "paid", status: { $in: ["processing", "shipped", "delivered"] } },
      { $set: { status } },
    );
  },
};
