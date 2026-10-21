import mongoose, { Schema, type Model, type Types } from "mongoose";

export type CartLine = { productId: Types.ObjectId; quantity: number };
export type CartDocument = { userId: Types.ObjectId; items: CartLine[]; lastMergeId?: string; updatedAt: Date };

const cartSchema = new Schema<CartDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: {
      type: [{
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1, max: 99 },
      }],
      default: [],
    },
    lastMergeId: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

const Cart = (mongoose.models.Cart as Model<CartDocument> | undefined)
  ?? mongoose.model<CartDocument>("Cart", cartSchema);

export default Cart;
