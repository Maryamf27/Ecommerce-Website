import mongoose, { Types } from "mongoose";
import Product, { type ProductDocument } from "@/models/Product";
import ProductTag from "@/models/ProductTag";
import Tag from "@/models/Tag";
import type { ProductCreateInput } from "@/lib/product-validation";
import type { TagDTO } from "@/types/product";

export type StoredProduct = ProductDocument & { _id: Types.ObjectId };

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
    const product = await Product.findOneAndDelete(productLookup(id)).select("_id").lean<{ _id: Types.ObjectId } | null>();
    if (!product) return false;
    await ProductTag.deleteMany({ productId: product._id });
    return true;
  },
  async findTagsByProductIds(productIds: Types.ObjectId[]) {
    const tagsByProduct = new Map<string, TagDTO[]>();
    if (productIds.length === 0) return tagsByProduct;

    const assignments = await ProductTag.find({ productId: { $in: productIds } })
      .select("productId tagId")
      .lean<Array<{ productId: Types.ObjectId; tagId: Types.ObjectId }>>();
    if (assignments.length === 0) return tagsByProduct;

    const tags = await Tag.find({ _id: { $in: assignments.map(({ tagId }) => tagId) } })
      .select("name slug")
      .lean<Array<{ _id: Types.ObjectId; name: string; slug: string }>>();
    const tagsById = new Map(tags.map((tag) => [tag._id.toString(), {
      _id: tag._id.toString(),
      name: tag.name,
      slug: tag.slug,
    }]));
    for (const assignment of assignments) {
      const tag = tagsById.get(assignment.tagId.toString());
      if (!tag) continue;
      const productId = assignment.productId.toString();
      const productTags = tagsByProduct.get(productId) ?? [];
      productTags.push(tag);
      tagsByProduct.set(productId, productTags);
    }
    return tagsByProduct;
  },
  async replaceProductTags(productId: Types.ObjectId, tagIds: Types.ObjectId[]) {
    const desired = new Set(tagIds.map((id) => id.toString()));
    const current = await ProductTag.find({ productId }).select("tagId").lean<Array<{ tagId: Types.ObjectId }>>();
    const currentIds = new Set(current.map(({ tagId }) => tagId.toString()));
    const additions = tagIds.filter((id) => !currentIds.has(id.toString()));
    if (additions.length > 0) {
      await ProductTag.insertMany(additions.map((tagId) => ({ productId, tagId })));
    }
    await ProductTag.deleteMany({
      productId,
      tagId: { $nin: [...desired].map((id) => new Types.ObjectId(id)) },
    });
  },
};

function productLookup(id: string) {
  return mongoose.isObjectIdOrHexString(id) ? { _id: id } : { externalId: Number(id) };
}
