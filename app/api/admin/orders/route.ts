import { connection } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/admin";
import { connectToDatabase } from "@/lib/db";
import { serializeOrder } from "@/lib/orders";
import { logServerError } from "@/lib/server-logging";
import Order, { type OrderDocument } from "@/models/Order";
import User from "@/models/User";

const noStore = { "Cache-Control": "no-store" };
export const instant = false;

export async function GET(request: Request) {
  await connection();
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    await connectToDatabase();
    const orders = await Order.find({ paymentStatus: { $ne: "expired" } }).sort({ createdAt: -1 }).limit(100).lean<Array<OrderDocument & { _id: Types.ObjectId }>>();
    const userIds = Array.from(new Set(orders.map((order) => order.userId.toString())));
    const users = await User.find({ _id: { $in: userIds } }).select("name email").lean<Array<{ _id: Types.ObjectId; name: string; email: string }>>();
    const byId = new Map(users.map((user) => [user._id.toString(), user]));
    return Response.json({
      success: true,
      data: orders.map((order) => ({ ...serializeOrder(order), customer: { name: byId.get(order.userId.toString())?.name ?? "Unknown", email: byId.get(order.userId.toString())?.email ?? "" } })),
    }, { headers: noStore });
  } catch (error) {
    logServerError("api/admin/orders GET", error);
    return Response.json({ success: false, error: { message: "Orders are temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}
