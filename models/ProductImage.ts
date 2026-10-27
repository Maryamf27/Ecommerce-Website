import mongoose, { Schema, type Model } from "mongoose";

export type ProductImageDocument = {
  data: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  size: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Images uploaded by admins. Stored in MongoDB so uploads work on hosts without a writable disk (e.g. Vercel). */
const productImageSchema = new Schema<ProductImageDocument>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, enum: ["image/png", "image/jpeg", "image/webp", "image/gif"], required: true },
    size: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, versionKey: false },
);

const ProductImage = (mongoose.models.ProductImage as Model<ProductImageDocument> | undefined)
  ?? mongoose.model<ProductImageDocument>("ProductImage", productImageSchema);

export default ProductImage;
