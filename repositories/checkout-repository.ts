import { Types } from "mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";

/** Database-only operations used by checkout. Payment-provider calls live in the service. */
export const checkoutRepository = {
  findProductsByIds(ids: string[]) {
    return Product.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }).lean();
  },

  findOrCreatePendingOrder(input: {
    userId: string;
    requestKey: string;
    items: Array<{ productId: Types.ObjectId; title: string; image: string; quantity: number; unitAmount: number }>;
    shipping: { name: string; email: string; address: string; city: string; postalCode: string; country: string };
    subtotal: number;
  }) {
    return Order.findOneAndUpdate(
      { userId: input.userId, requestKey: input.requestKey },
      {
        $setOnInsert: {
          ...input,
          shippingAmount: 0,
          taxAmount: 0,
          total: input.subtotal,
          currency: "usd",
          paymentStatus: "pending",
          status: "pending",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  },

  saveStripeSession(orderId: Types.ObjectId, sessionId: string) {
    return Order.updateOne(
      { _id: orderId, $or: [{ stripeSessionId: { $exists: false } }, { stripeSessionId: sessionId }] },
      { $set: { stripeSessionId: sessionId } },
    );
  },
};
