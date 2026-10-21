import { Types } from "mongoose";
import { connection } from "next/server";
import { findSessionUser, getRequestSessionToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import Order from "@/models/Order";

const noStore = { "Cache-Control": "no-store" };
export const instant = false;

export async function GET(request: Request) {
  await connection();
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Sign in to view this order." } }, { status: 401, headers: noStore });
    const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) return Response.json({ success: false, error: { message: "Order reference is invalid." } }, { status: 400, headers: noStore });
    await connectToDatabase();
    const order = await Order.findOne({ userId: new Types.ObjectId(user.id), stripeSessionId: sessionId }).lean();
    if (!order) return Response.json({ success: false, error: { message: "Order not found." } }, { status: 404, headers: noStore });
    return Response.json({ success: true, data: { id: order._id.toString(), paymentStatus: order.paymentStatus, status: order.status, total: order.total / 100, inventoryIssues: (order.inventoryIssues ?? []).map((issue) => ({ title: issue.title, requested: issue.requested, available: issue.available })), items: order.items.map((item) => ({ title: item.title, quantity: item.quantity, lineTotal: item.unitAmount * item.quantity / 100 })) } }, { headers: noStore });
  } catch (error) {
    logServerError("api/orders GET", error);
    return Response.json({ success: false, error: { message: "Order information is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}
