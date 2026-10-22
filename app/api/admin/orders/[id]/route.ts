import { requireAdmin } from "@/lib/admin";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import Order from "@/models/Order";

const noStore = { "Cache-Control": "no-store" };
const fulfilment = ["processing", "shipped", "delivered"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return Response.json({ success: false, error: { message: "Order id is invalid." } }, { status: 400, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
  const status = body && typeof body === "object" && "status" in body ? (body as { status: unknown }).status : undefined;
  if (typeof status !== "string" || !(fulfilment as readonly string[]).includes(status)) {
    return Response.json({ success: false, error: { message: "Status must be processing, shipped or delivered." } }, { status: 400, headers: noStore });
  }
  try {
    await connectToDatabase();
    // Only paid orders already in the fulfilment flow can be moved; inventory issues and unpaid orders are left alone.
    const result = await Order.updateOne({ _id: id, paymentStatus: "paid", status: { $in: fulfilment } }, { $set: { status } });
    if (result.matchedCount !== 1) return Response.json({ success: false, error: { message: "Only paid orders in fulfilment can change status." } }, { status: 409, headers: noStore });
    return Response.json({ success: true, data: { id, status } }, { headers: noStore });
  } catch (error) {
    logServerError("api/admin/orders PATCH", error);
    return Response.json({ success: false, error: { message: "Order could not be updated." } }, { status: 503, headers: noStore });
  }
}
