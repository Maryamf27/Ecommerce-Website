import mongoose, { Types } from "mongoose";
import Cart, { type CartLine } from "@/models/Cart";
import Wishlist from "@/models/Wishlist";
import Product from "@/models/Product";
import type { ProductDTO } from "@/types/product";
import { getStockStatus } from "@/lib/inventory";

export const MAX_CART_QUANTITY = 99;
export const MAX_CART_ITEMS = 100;
export const MAX_WISHLIST_ITEMS = 500;

type ProductRecord = {
  _id: Types.ObjectId;
  externalId: number | null;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: { rate: number; count: number };
  stock: number;
  stockManaged?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CartViewItem = { product: ProductDTO; quantity: number; lineTotal: number; available: boolean };

export function parseProductIds(value: unknown, max = MAX_WISHLIST_ITEMS): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !mongoose.isObjectIdOrHexString(item)) return null;
    const id = item.toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseCartLines(value: unknown): Array<{ productId: string; quantity: number }> | null {
  if (!Array.isArray(value) || value.length > MAX_CART_ITEMS) return null;
  const lines = new Map<string, number>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (typeof item.productId !== "string" || !mongoose.isObjectIdOrHexString(item.productId)
      || !Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > MAX_CART_QUANTITY) return null;
    const id = item.productId.toLowerCase();
    const quantity = (lines.get(id) ?? 0) + (item.quantity as number);
    if (quantity > MAX_CART_QUANTITY) return null;
    lines.set(id, quantity);
  }
  return Array.from(lines, ([productId, quantity]) => ({ productId, quantity }));
}

function serializeProduct(product: ProductRecord): ProductDTO {
  return {
    _id: product._id.toString(),
    externalId: product.externalId ?? null,
    title: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    image: product.image,
    rating: product.rating,
    stock: Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0,
    stockStatus: getStockStatus(Number.isSafeInteger(product.stock) && product.stock >= 0 ? product.stock : 0),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function resolveCart(lines: Array<{ productId: string; quantity: number }>): Promise<CartViewItem[]> {
  if (lines.length === 0) return [];
  const ids = lines.map((line) => new Types.ObjectId(line.productId));
  const records = await Product.find({ _id: { $in: ids } }).lean<ProductRecord[]>();
  const products = new Map(records.map((product) => [product._id.toString(), product]));
  return lines.flatMap((line) => {
    const product = products.get(line.productId);
    if (!product) return [];
    const dto = serializeProduct(product);
    return [{ product: dto, quantity: line.quantity, lineTotal: dto.price * line.quantity, available: dto.stock > 0 && line.quantity <= dto.stock }];
  });
}

export async function resolveWishlist(ids: string[]): Promise<ProductDTO[]> {
  if (ids.length === 0) return [];
  const records = await Product.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }).lean<ProductRecord[]>();
  const byId = new Map(records.map((product) => [product._id.toString(), product]));
  return ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [serializeProduct(product)] : [];
  });
}

export async function getCart(userId: string): Promise<{ items: CartViewItem[]; subtotal: number; count: number }> {
  const cart = await Cart.findOne({ userId }).lean<{ items: CartLine[] } | null>();
  const lines = (cart?.items ?? []).map((item) => ({ productId: item.productId.toString(), quantity: item.quantity }));
  const items = await resolveCart(lines);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items, subtotal, count: items.reduce((sum, item) => sum + item.quantity, 0) };
}

export async function setCart(userId: string, lines: Array<{ productId: string; quantity: number }>) {
  const stockIssues = await getCartStockIssues(lines);
  if (stockIssues.length > 0) throw new CartStockError(stockIssues);
  await Cart.findOneAndUpdate(
    { userId },
    { $set: { items: lines.map((line) => ({ productId: new Types.ObjectId(line.productId), quantity: line.quantity })) } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return getCart(userId);
}

export type CartStockIssue = { productId: string; title: string; requested: number; available: number };
export class CartStockError extends Error {
  constructor(readonly issues: CartStockIssue[]) { super("Cart quantities exceed current stock."); }
}

export async function getCartStockIssues(lines: Array<{ productId: string; quantity: number }>): Promise<CartStockIssue[]> {
  if (lines.length === 0) return [];
  const products = await Product.find({ _id: { $in: lines.map((line) => new Types.ObjectId(line.productId)) } }).select("title stock").lean<Array<{ _id: Types.ObjectId; title: string; stock: number }>>();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));
  return lines.flatMap((line) => {
    const product = byId.get(line.productId);
    const available = Number.isSafeInteger(product?.stock) && (product?.stock ?? 0) >= 0 ? product!.stock : 0;
    return available < line.quantity ? [{ productId: line.productId, title: product?.title ?? "Removed product", requested: line.quantity, available }] : [];
  });
}

export async function getWishlist(userId: string): Promise<ProductDTO[]> {
  const wishlist = await Wishlist.findOne({ userId }).lean<{ productIds: Types.ObjectId[] } | null>();
  return resolveWishlist((wishlist?.productIds ?? []).map((id) => id.toString()));
}

export async function setWishlist(userId: string, ids: string[]): Promise<ProductDTO[]> {
  await Wishlist.findOneAndUpdate(
    { userId },
    { $set: { productIds: ids.map((id) => new Types.ObjectId(id)) } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return getWishlist(userId);
}

export async function mergeCommerce(userId: string, guestLines: Array<{ productId: string; quantity: number }>, guestIds: string[], mergeId: string) {
  const [savedCart, savedWishlist] = await Promise.all([
    Cart.findOne({ userId }).lean<{ items: CartLine[]; lastMergeId?: string } | null>(),
    Wishlist.findOne({ userId }).lean<{ productIds: Types.ObjectId[]; lastMergeId?: string } | null>(),
  ]);

  if (savedCart?.lastMergeId !== mergeId) {
    const quantities = new Map<string, number>();
    for (const line of savedCart?.items ?? []) quantities.set(line.productId.toString(), line.quantity);
    for (const line of guestLines) {
      const quantity = (quantities.get(line.productId) ?? 0) + line.quantity;
      if (quantity > MAX_CART_QUANTITY) throw new RangeError("Combined cart quantity exceeds the allowed limit.");
      quantities.set(line.productId, quantity);
    }
    const mergedLines = Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
    const savedQuantities = new Map((savedCart?.items ?? []).map((line) => [line.productId.toString(), line.quantity]));
    const guestAdditions = guestLines.map((line) => ({ productId: line.productId, quantity: (savedQuantities.get(line.productId) ?? 0) + line.quantity }));
    const stockIssues = await getCartStockIssues(guestAdditions);
    if (stockIssues.length > 0) throw new CartStockError(stockIssues);
    const resolved = await resolveCart(mergedLines);
    const activeLines = mergedLines.filter((line) => resolved.some((item) => item.product._id === line.productId));
    try {
      await Cart.findOneAndUpdate(
        { userId, lastMergeId: { $ne: mergeId } },
        { $set: { items: activeLines.map((line) => ({ productId: new Types.ObjectId(line.productId), quantity: line.quantity })), lastMergeId: mergeId } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      const latest = await Cart.findOne({ userId }).select("lastMergeId").lean<{ lastMergeId?: string } | null>();
      if (latest?.lastMergeId !== mergeId) throw error;
    }
  }

  if (savedWishlist?.lastMergeId !== mergeId) {
    const ids = new Set((savedWishlist?.productIds ?? []).map((id) => id.toString()));
    for (const id of guestIds) ids.add(id);
    const validWishlist = await resolveWishlist(Array.from(ids));
    try {
      await Wishlist.findOneAndUpdate(
        { userId, lastMergeId: { $ne: mergeId } },
        { $set: { productIds: validWishlist.map((product) => new Types.ObjectId(product._id)), lastMergeId: mergeId } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      const latest = await Wishlist.findOne({ userId }).select("lastMergeId").lean<{ lastMergeId?: string } | null>();
      if (latest?.lastMergeId !== mergeId) throw error;
    }
  }

  const [cart, wishlist] = await Promise.all([getCart(userId), getWishlist(userId)]);
  return { cart, wishlist };
}
