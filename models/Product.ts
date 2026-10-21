import mongoose, { Schema, type Model } from "mongoose";
import type { ProductRating } from "@/types/product";

export type ProductDocument = {
  externalId: number | null;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: ProductRating;
  stock: number;
  stockManaged: boolean;
  source: "fake-store" | "local";
  protectedFields: Array<"title" | "description" | "price" | "category" | "image" | "rating">;
  createdAt: Date;
  updatedAt: Date;
};

const ratingSchema = new Schema<ProductRating>(
  {
    rate: { type: Number, required: true, min: 0, max: 5, default: 0 },
    count: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const productSchema = new Schema<ProductDocument>(
  {
    externalId: { type: Number, default: null, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    image: { type: String, required: true, trim: true, maxlength: 2048 },
    rating: { type: ratingSchema, required: true, default: () => ({ rate: 0, count: 0 }) },
    stock: { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isSafeInteger, message: "stock must be a non-negative integer." } },
    stockManaged: { type: Boolean, required: true, default: false },
    source: { type: String, enum: ["fake-store", "local"], required: true, default: "local" },
    protectedFields: {
      type: [{ type: String, enum: ["title", "description", "price", "category", "image", "rating"] }],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

productSchema.index(
  { externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "number" } } },
);
productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });

const Product = (mongoose.models.Product as Model<ProductDocument> | undefined)
  ?? mongoose.model<ProductDocument>("Product", productSchema);

export default Product;
