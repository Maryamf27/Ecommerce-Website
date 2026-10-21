import mongoose, { Schema, type Model, type Types } from "mongoose";

export type OrderLine = {
  productId: Types.ObjectId;
  title: string;
  image: string;
  quantity: number;
  unitAmount: number;
};
export type ShippingAddress = {
  name: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};
export type OrderInventoryIssue = { productId: Types.ObjectId; title: string; requested: number; available: number };
export type OrderDocument = {
  userId: Types.ObjectId;
  requestKey: string;
  items: OrderLine[];
  shipping: ShippingAddress;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  total: number;
  currency: "usd";
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paymentStatus: "pending" | "paid" | "failed" | "expired";
  status: "pending" | "processing" | "cancelled" | "inventory_issue";
  inventoryIssues?: OrderInventoryIssue[];
  createdAt: Date;
  updatedAt: Date;
};

const orderSchema = new Schema<OrderDocument>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  requestKey: { type: String, required: true, maxlength: 64 },
  items: { type: [{ productId: { type: Schema.Types.ObjectId, ref: "Product", required: true }, title: { type: String, required: true }, image: { type: String, required: true }, quantity: { type: Number, required: true, min: 1, max: 99 }, unitAmount: { type: Number, required: true, min: 0 } }], required: true },
  shipping: { name: { type: String, required: true }, email: { type: String, required: true }, address: { type: String, required: true }, city: { type: String, required: true }, postalCode: { type: String, required: true }, country: { type: String, required: true } },
  subtotal: { type: Number, required: true, min: 1 }, shippingAmount: { type: Number, required: true, default: 0 },
  taxAmount: { type: Number, required: true, default: 0 }, total: { type: Number, required: true, min: 1 },
  currency: { type: String, enum: ["usd"], required: true, default: "usd" },
  stripeSessionId: { type: String }, stripePaymentIntentId: { type: String },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "expired"], required: true, default: "pending" },
  status: { type: String, enum: ["pending", "processing", "cancelled", "inventory_issue"], required: true, default: "pending" },
  inventoryIssues: { type: [{ productId: { type: Schema.Types.ObjectId, ref: "Product", required: true }, title: { type: String, required: true }, requested: { type: Number, required: true, min: 1 }, available: { type: Number, required: true, min: 0 } }], default: [] },
}, { timestamps: true, versionKey: false });
orderSchema.index({ userId: 1, requestKey: 1 }, { unique: true });
orderSchema.index({ stripeSessionId:  1 }, { unique: true, sparse: true });
orderSchema.index({ userId: 1, createdAt: -1 });

const Order = (mongoose.models.Order as Model<OrderDocument> | undefined) ?? mongoose.model<OrderDocument>("Order", orderSchema);
export default Order;
