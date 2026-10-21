import mongoose, { Types } from "mongoose";
import Product, { type ProductDocument } from "@/models/Product";
import type { FakeStoreProduct, ProductDTO } from "@/types/product";
import type { ProductCreateInput, ProductUpdateInput } from "@/lib/product-validation";

type StoredProduct = ProductDocument & { _id: Types.ObjectId };

export type ProductListQuery = {
  page: number;
  limit: number;
  search: string;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  sort: "newest" | "price_asc" | "price_desc" | "rating_desc";
};

export function parseProductListQuery(params: URLSearchParams):
  | { success: true; data: ProductListQuery }
  | { success: false; message: string } {
  const parseInteger = (key: string, fallback: number, max: number) => {
    const value = params.get(key);
    if (value === null) return fallback;
    if (!/^\d+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 1 && number <= max ? number : null;
  };
  const page = parseInteger("page", 1, 1_000_000);
  const limit = parseInteger("limit", 12, 48);
  if (page === null || limit === null) return { success: false, message: "page must be positive and limit must be between 1 and 48." };

  const search = (params.get("search") ?? "").trim();
  const category = (params.get("category") ?? "").trim();
  if (search.length > 100) return { success: false, message: "search must be 100 characters or fewer." };
  if (category.length > 100) return { success: false, message: "category must be 100 characters or fewer." };

  const parsePrice = (key: string): number | undefined | null => {
    const value = params.get(key);
    if (value === null || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const minPrice = parsePrice("minPrice");
  const maxPrice = parsePrice("maxPrice");
  if (minPrice === null || maxPrice === null) return { success: false, message: "Price filters must be finite non-negative numbers." };
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return { success: false, message: "minPrice cannot be greater than maxPrice." };
  }

  const sort = params.get("sort") ?? "newest";
  if (!["newest", "price_asc", "price_desc", "rating_desc"].includes(sort)) {
    return { success: false, message: "sort must be newest, price_asc, price_desc, or rating_desc." };
  }

  return { success: true, data: { page, limit, search, category, minPrice, maxPrice, sort: sort as ProductListQuery["sort"] } };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeProduct(product: StoredProduct): ProductDTO {
  return {
    _id: product._id.toString(),
    externalId: product.externalId ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    image: product.image,
    rating: { rate: product.rating.rate, count: product.rating.count },
    stock: product.stock,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function listProducts(query: ProductListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ title: pattern }, { description: pattern }, { category: pattern }];
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const range: Record<string, number> = {};
    if (query.minPrice !== undefined) range.$gte = query.minPrice;
    if (query.maxPrice !== undefined) range.$lte = query.maxPrice;
    filter.price = range;
  }

  const sortOptions: Record<ProductListQuery["sort"], Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: 1 },
    rating_desc: { "rating.rate": -1, createdAt: -1 },
  };
  const sort = sortOptions[query.sort];
  const [items, total, categories] = await Promise.all([
    Product.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean<StoredProduct[]>(),
    Product.countDocuments(filter),
    Product.distinct("category"),
  ]);

  return {
    products: items.map(serializeProduct),
    categories: categories.filter((value): value is string => typeof value === "string").sort((a, b) => a.localeCompare(b)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export function validProductId(id: string): boolean {
  return mongoose.isObjectIdOrHexString(id) || (/^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0);
}

function productLookup(id: string) {
  if (mongoose.isObjectIdOrHexString(id)) return { _id: id };
  const externalId = Number(id);
  return { externalId };
}

export async function getProduct(id: string): Promise<ProductDTO | null> {
  if (!validProductId(id)) return null;
  const product = await Product.findOne(productLookup(id)).lean<StoredProduct | null>();
  return product ? serializeProduct(product) : null;
}

export async function createProduct(input: ProductCreateInput): Promise<ProductDTO> {
  const product = await Product.create({
    ...input,
    externalId: input.externalId ?? null,
    rating: input.rating ?? { rate: 0, count: 0 },
    stock: input.stock ?? 0,
    source: "local",
    protectedFields: input.externalId === undefined
      ? []
      : ["title", "description", "price", "category", "image", "rating"],
  });
  return serializeProduct(product.toObject() as StoredProduct);
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<ProductDTO | null> {
  if (!validProductId(id)) return null;
  const update: Record<string, unknown> = { $set: input };
  const protectedFields = Object.keys(input).filter((key) => ["title", "description", "price", "category", "image", "rating"].includes(key));
  if (protectedFields.length > 0) update.$addToSet = { protectedFields: { $each: protectedFields } };
  const product = await Product.findOneAndUpdate(productLookup(id), update, { new: true, runValidators: true }).lean<StoredProduct | null>();
  return product ? serializeProduct(product) : null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (!validProductId(id)) return false;
  const result = await Product.deleteOne(productLookup(id));
  return result.deletedCount === 1;
}

export function parseFakeStoreProduct(value: unknown): FakeStoreProduct | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || typeof item.id !== "number" || item.id < 1
    || typeof item.title !== "string" || !item.title.trim()
    || typeof item.description !== "string"
    || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0
    || typeof item.category !== "string" || !item.category.trim()
    || typeof item.image !== "string" || item.image.length > 2048) return null;
  let imageUrl: URL;
  try { imageUrl = new URL(item.image); } catch { return null; }
  if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") return null;

  const rating = item.rating;
  if (typeof rating !== "object" || rating === null || Array.isArray(rating)) return null;
  const rawRating = rating as Record<string, unknown>;
  if (typeof rawRating.rate !== "number" || !Number.isFinite(rawRating.rate) || rawRating.rate < 0 || rawRating.rate > 5
    || !Number.isSafeInteger(rawRating.count) || (rawRating.count as number) < 0) return null;

  return {
    id: item.id,
    title: item.title.trim().slice(0, 180),
    description: item.description.slice(0, 4000),
    price: item.price,
    category: item.category.trim().slice(0, 100),
    image: item.image,
    rating: { rate: rawRating.rate, count: rawRating.count as number },
  };
}

export async function importFakeStoreProducts(values: unknown) {
  if (!Array.isArray(values)) throw new Error("Fake Store API response must be a product array.");
  let imported = 0;
  let skipped = 0;
  let inserted = 0;

  for (const value of values) {
    const item = parseFakeStoreProduct(value);
    if (!item) { skipped += 1; continue; }

    const existing = await Product.findOne({ externalId: item.id }).select("protectedFields").lean<{ protectedFields: ProductDocument["protectedFields"] } | null>();
    const protectedFields = new Set(existing?.protectedFields ?? []);
    const remoteFields: Record<string, unknown> = {
      title: item.title,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      rating: item.rating,
    };
    for (const field of protectedFields) delete remoteFields[field];

    const result = await Product.updateOne(
      { externalId: item.id },
      {
        $set: remoteFields,
        $setOnInsert: { externalId: item.id, source: "fake-store", stock: 0, protectedFields: [] },
      },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount === 1) inserted += 1;
    imported += 1;
  }

  return { received: values.length, imported, inserted, updated: imported - inserted, skipped };
}
