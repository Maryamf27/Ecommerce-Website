import mongoose, { Schema, type Model, type Types } from "mongoose";

export type ProductTagDocument = {
  productId: Types.ObjectId;
  tagId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const productTagSchema = new Schema<ProductTagDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    tagId: {
      type: Schema.Types.ObjectId,
      ref: "Tag",
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);


productTagSchema.index(
  { productId: 1, tagId: 1 },
  { unique: true },
);

productTagSchema.index({ tagId: 1, productId: 1 });

const ProductTag =
  (mongoose.models.ProductTag as Model<ProductTagDocument> | undefined) ??
  mongoose.model<ProductTagDocument>(
    "ProductTag",
    productTagSchema,
    "producttags",
  );

export default ProductTag;