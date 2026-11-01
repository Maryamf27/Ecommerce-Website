import mongoose, { Types } from "mongoose";
import Product, { type ProductDocument } from "@/models/Product";
import type { ProductCreateInput, ProductUpdateInput } from "@/lib/product-validation";

export type StoredProduct = ProductDocument & { _id: Types.ObjectId };

/** Database-only operations for the product catalog. No HTTP or response formatting here. */
export const productRepository = {
  async findMany(filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) {
    return Product.find(filter).sort(sort).skip(skip).limit(limit).lean<StoredProduct[]>();
  },
  count(filter: Record<string, unknown>) {
    return Product.countDocuments(filter);
  },
  distinctCategories() {
    return Product.distinct("category");
  },
  findById(id: string) {
    return Product.findOne(productLookup(id)).lean<StoredProduct | null>();
  },
  async create(input: ProductCreateInput, defaults: Record<string, unknown>) {
    const product = await Product.create({ ...input, ...defaults });
    return product.toObject() as StoredProduct;
  },
  update(id: string, update: Record<string, unknown>) {
    return Product.findOneAndUpdate(productLookup(id), update, { new: true, runValidators: true }).lean<StoredProduct | null>();
  },
  async delete(id: string) {
    const result = await Product.deleteOne(productLookup(id));
    return result.deletedCount === 1;
  },
};

function productLookup(id: string) {
  return mongoose.isObjectIdOrHexString(id) ? { _id: id } : { externalId: Number(id) };
}
