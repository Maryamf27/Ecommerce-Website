import { connection } from "next/server";
import { findSessionUser, getRequestSessionToken } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { connectToDatabase } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-error";
import { getCustomerOrderBySession, listAdminOrders, updateAdminOrderStatus } from "@/services/order-service";

const noStore = { "Cache-Control": "no-store" };
const fulfilment = ["processing", "shipped", "delivered"] as const;

export async function getCustomerOrder(request: Request) {
  await connection();
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Sign in to view this order." } }, { status: 401, headers: noStore });
    if (user.role === "admin") return Response.json({ success: false, error: { message: "Administrator accounts do not have customer orders." } }, { status: 403, headers: noStore });
    const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) return Response.json({ success: false, error: { message: "Order reference is invalid." } }, { status: 400, headers: noStore });
    await connectToDatabase();
    const order = await getCustomerOrderBySession(user.id, sessionId);
    if (!order) return Response.json({ success: false, error: { message: "Order not found." } }, { status: 404, headers: noStore });
    return Response.json({ success: true, data: { id: order._id.toString(), paymentStatus: order.paymentStatus, status: order.status, total: order.total / 100, inventoryIssues: (order.inventoryIssues ?? []).map((issue) => ({ title: issue.title, requested: issue.requested, available: issue.available })), items: order.items.map((item) => ({ title: item.title, quantity: item.quantity, lineTotal: item.unitAmount * item.quantity / 100 })) } }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse({ context: "api/orders GET", error, message: "Order information is temporarily unavailable.", status: 503, headers: noStore });
  }
}

export async function getAdminOrders(request: Request) {
  await connection();
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    await connectToDatabase();
    return Response.json({ success: true, data: await listAdminOrders() }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse({ context: "api/admin/orders GET", error, message: "Orders are temporarily unavailable.", status: 503, headers: noStore });
  }
}

export async function patchAdminOrder(request: Request, id: string) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin.ok) return admin.response;
  if (!/^[a-f\d]{24}$/i.test(id)) return Response.json({ success: false, error: { message: "Order id is invalid." } }, { status: 400, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
  const status = body && typeof body === "object" && "status" in body ? (body as { status: unknown }).status : undefined;
  if (typeof status !== "string" || !(fulfilment as readonly string[]).includes(status)) {
    return Response.json({ success: false, error: { message: "Status must be processing, shipped or delivered." } }, { status: 400, headers: noStore });
  }
  try {
    await connectToDatabase();
    const result = await updateAdminOrderStatus(id, status);
    if (result.matchedCount !== 1) return Response.json({ success: false, error: { message: "Only paid orders in fulfilment can change status." } }, { status: 409, headers: noStore });
    return Response.json({ success: true, data: { id, status } }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse({ context: "api/admin/orders PATCH", error, message: "Order could not be updated.", status: 503, headers: noStore });
  }
}
