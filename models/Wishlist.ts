import mongoose, { Schema, type Model, type Types } from "mongoose";

export type WishlistDocument = { userId: Types.ObjectId; productIds: Types.ObjectId[]; lastMergeId?: string; updatedAt: Date };

const wishlistSchema = new Schema<WishlistDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    productIds: { type: [{ type: Schema.Types.ObjectId, ref: "Product" }], default: [] },
    lastMergeId: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

const Wishlist = (mongoose.models.Wishlist as Model<WishlistDocument> | undefined)
  ?? mongoose.model<WishlistDocument>("Wishlist", wishlistSchema);

export default Wishlist;
