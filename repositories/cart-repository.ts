import { Types } from "mongoose";
import Cart, { type CartLine } from "@/models/Cart";
import Product from "@/models/Product";

/** Database-only cart and product reads/writes. No HTTP or business rules here. */
export const cartRepository = {
  findCartItems(userId: string) {
    return Cart.findOne({ userId }).lean<{ items: CartLine[] } | null>();
  },
  findProductsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return Product.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }).lean();
  },
  findStockByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return Product.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select("title stock")
      .lean<Array<{ _id: Types.ObjectId; title: string; stock: number }>>();
  },
  saveCart(userId: string, lines: Array<{ productId: string; quantity: number }>) {
    return Cart.findOneAndUpdate(
      { userId },
      { $set: { items: lines.map((line) => ({ productId: new Types.ObjectId(line.productId), quantity: line.quantity })) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  },
};
